import {
  CHAIN_REACHES,
  type ChainReach,
  chainOf,
  isOwnSlotReach,
  isSlotReach,
  type Reach,
  REACHES,
} from '../../system-model-exploration.ts';
import { useCardActions } from './exploration-reading.ts';
import type { CanvasPoint } from './place-locally.ts';

/*
 * What a card reaches that the diagram does not draw yet, and the chains
 * that can be followed from it.
 */

type Reading = Pick<
  ReturnType<typeof useCardActions>,
  'drawn' | 'neighbours' | 'elements'
>;

/** What one card still reaches: by each way it does, and by each chain followed. */
interface Reaching {
  missing: { each: Reach; missing: string[] }[] | null;
  chains: { each: ChainReach; missing: string[] }[];
}

/**
 * Whether a card offers to bring others in this way. Its own slots' types
 * it does not: they are its badges already, so the offer would bring
 * nothing the card does not show — not one by one, not as a chain.
 */
const offered = (reach: Reach) => !isOwnSlotReach(reach);

/*
 * Worked out once for each card and kept until what is drawn changes: a
 * card asks for it wherever it shows a way to bring others in — its dots,
 * its plus, its menu — each time it is drawn.
 */
const known = new WeakMap<
  ReadonlySet<string>,
  { reading: Reading; cards: Map<string, Reaching> }
>();

function reachingOf(id: string, reading: Reading): Reaching {
  const { drawn, neighbours, elements } = reading;
  let kept = known.get(drawn);
  if (
    kept === undefined ||
    kept.reading.neighbours !== neighbours ||
    kept.reading.elements !== elements
  ) {
    kept = { reading, cards: new Map() };
    known.set(drawn, kept);
  }
  let card = kept.cards.get(id);
  if (card === undefined) {
    const reach = neighbours.get(id);
    card = {
      missing:
        reach === undefined
          ? null
          : REACHES.filter(offered)
              .map((each) => ({
                each,
                missing: reach[each].filter((other) => !drawn.has(other)),
              }))
              .filter(({ missing }) => missing.length > 0),
      chains: CHAIN_REACHES.filter(offered)
        .map((each) => ({
          each,
          missing: chainOf(neighbours, elements, id, each).filter(
            (other) => !drawn.has(other),
          ),
        }))
        .filter(({ missing }) => missing.length > 0),
    };
    kept.cards.set(id, card);
  }
  return card;
}

/** What the element still reaches that is not drawn, by each way it does. */
export function useMissing(id: string) {
  return reachingOf(id, useCardActions()).missing;
}

/** The element that holds this one, when it is not on the diagram; null when it is, or nothing holds it. */
export function useMissingParent(id: string) {
  const reading = useCardActions();
  const [parent] =
    reachingOf(id, reading).missing?.find(({ each }) => each === 'isPartOf')
      ?.missing ?? [];
  return parent === undefined ? null : (reading.elements.get(parent) ?? null);
}

/**
 * Whether a card's own menu has anything to offer: a frame's setting out
 * again of what it holds, or others it reaches to bring in.
 */
export function hasNodeMenu(id: string, holds: boolean, reading: Reading) {
  const { missing, chains } = reachingOf(id, reading);
  return holds || (missing?.length ?? 0) > 0 || chains.length > 0;
}

/** Puts others on the diagram beside the card; what it contains, arranged inside it. */
export function useAdd(
  id: string,
  reach: Reach,
  at: CanvasPoint | null = null,
) {
  const { onShow } = useCardActions();
  // Asked for at a point in a frame, what it contains goes round that point,
  // and the frame is left as it is laid out.
  // Brought in by a slot, they are its badges, not cards of their own.
  return (ids: string[]) =>
    at !== null && reach === 'contains'
      ? onShow(ids, true, id, false, at)
      : onShow(
          ids,
          true,
          id,
          reach === 'contains',
          undefined,
          isSlotReach(reach),
        );
}

/** What each way reaches step after step, up to its own type or the depth, that is not drawn. */
export function useChains(id: string) {
  return reachingOf(id, useCardActions()).chains;
}
