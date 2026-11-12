import { recordOf } from '#/shared/collections.ts';
import {
  type ChainReach,
  DRAWN_RELATIONS,
  type DrawnRelationKind,
  type Reach,
  REACHES,
  RELATION_OF_REACH,
} from './exploration-relations.ts';
import {
  type Exploration,
  type ExploredElement,
  groupOf,
} from './exploration.model.ts';

/*
 * How one element reaches the others — its neighbours, each way — and the
 * chains followed from it.
 */

/**
 * Whom an element is joined to, by how; "state of" is "has state" read from
 * the target, "extended by" is "extends" so, "invoked by" is "invokes" so.
 */
export type Neighbours = Record<Reach, string[]>;

/** Every element's neighbours, whatever is drawn. */
export function neighboursOf(
  exploration: Exploration,
): ReadonlyMap<string, Neighbours> {
  const map = new Map<string, Neighbours>(
    exploration.elements.map(({ id }) => [
      id,
      recordOf(REACHES, (): string[] => []),
    ]),
  );
  for (const { id, container } of exploration.elements) {
    if (container === null) continue;
    map.get(container)?.contains.push(id);
    map.get(id)?.isPartOf.push(container);
  }
  for (const { kind, reach, back } of DRAWN_RELATIONS)
    for (const [source, target] of exploration.edges[kind]) {
      map.get(source)?.[reach].push(target);
      map.get(target)?.[back].push(source);
    }
  return map;
}

/** How many steps a chain is followed at most, when the card's type is far off or never met. */
export const CHAIN_DEPTH = 5;

/** The relation a chain is drawn with. */
export const relationOfChain = (reach: ChainReach): DrawnRelationKind =>
  RELATION_OF_REACH.get(reach) ?? 'invokes';

/**
 * Everything an element reaches one way, step after step, up to the next
 * element of its own type: that one is reached, but not followed further.
 * Only behaviors invoke, so a building block's or module's calls are its
 * behaviors', and a behavior stops the chain when the block it is on is
 * of the type it started from. Those behaviors, and the blocks such a
 * chain ends on, are reached too, so the chain reads whole. It goes no
 * more than `depth` steps from the element, or from its behaviors.
 */
export function chainOf(
  neighbours: ReadonlyMap<string, Neighbours>,
  elements: ReadonlyMap<string, ExploredElement>,
  id: string,
  reach: ChainReach,
  depth: number = CHAIN_DEPTH,
): string[] {
  const start = elements.get(id);
  if (start === undefined) return [];
  const type = groupOf(start);
  const throughBehaviours =
    (reach === 'invokes' || reach === 'invokedBy') &&
    (start.kind === 'module' || start.kind === 'building_block');
  const blockOf = (element: ExploredElement) =>
    element.kind === 'behavior' && element.container !== null
      ? elements.get(element.container)
      : undefined;
  const ends = (element: ExploredElement) => {
    if (groupOf(element) === type) return true;
    const block = throughBehaviours ? blockOf(element) : undefined;
    return block !== undefined && block.id !== id && groupOf(block) === type;
  };

  const reached = new Set<string>([id]);
  const order: string[] = [];
  const reachOf = (each: string) => {
    reached.add(each);
    order.push(each);
  };
  let frontier = [id];
  if (throughBehaviours) {
    // What is inside it, all the way down, that calls or is called.
    const inside = (holder: string): string[] =>
      (neighbours.get(holder)?.contains ?? []).flatMap((kid) => [
        kid,
        ...inside(kid),
      ]);
    frontier = inside(id).filter(
      (each) =>
        elements.get(each)?.kind === 'behavior' &&
        (neighbours.get(each)?.[reach].length ?? 0) > 0,
    );
    for (const each of frontier) reachOf(each);
  }
  for (let step = 0; step < depth && frontier.length > 0; step++) {
    const next: string[] = [];
    for (const from of frontier)
      for (const to of neighbours.get(from)?.[reach] ?? []) {
        const element = elements.get(to);
        if (reached.has(to) || element === undefined) continue;
        reachOf(to);
        if (!ends(element)) {
          next.push(to);
          continue;
        }
        const block = throughBehaviours ? blockOf(element) : undefined;
        if (block !== undefined && !reached.has(block.id)) reachOf(block.id);
      }
    frontier = next;
  }
  return order;
}
