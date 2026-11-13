import {
  CHAIN_REACHES,
  chainOf,
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

/** What the element still reaches that is not drawn, by each way it does. */
export function useMissing(id: string) {
  const { drawn, neighbours } = useCardActions();
  const reach = neighbours.get(id);
  if (reach === undefined) return null;
  return REACHES.map((each) => ({
    each,
    missing: reach[each].filter((other) => !drawn.has(other)),
  })).filter(({ missing }) => missing.length > 0);
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
  // Brought in by a slot, they are its badges while slots are on cards.
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
  const { drawn, neighbours, elements } = useCardActions();
  return CHAIN_REACHES.map((each) => ({
    each,
    missing: chainOf(neighbours, elements, id, each).filter(
      (other) => !drawn.has(other),
    ),
  })).filter(({ missing }) => missing.length > 0);
}
