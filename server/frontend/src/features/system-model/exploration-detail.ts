import { byIdOf } from '#/shared/collections.ts';
import type {
  DrawnElement,
  DrawnRelation,
  ExplorationGraph,
} from './exploration-graph.ts';
import { drawnIdOf } from './exploration-relations.ts';

/*
 * How much of the diagram is seen at the zoom it is looked at from. Close
 * up, all of it. From further off the behaviors drawn inside a frame step
 * out of sight, and their relations move up to the blocks that hold them;
 * further off still, so does everything else a module holds, and the
 * modules alone are left, with the relations between them. Nothing is
 * placed anew on the way: what is unseen keeps its place, and is back as
 * the reader comes closer.
 */

/** All that is drawn; without the behaviors in frames; or modules without what they hold. */
export type Detail = 'all' | 'blocks' | 'modules';

/** The zoom below which behaviors step out of sight. */
const BLOCKS_BELOW = 0.5;
/** The zoom below which all that a module holds does. */
const MODULES_BELOW = 0.25;

export const detailAt = (zoom: number): Detail => {
  if (zoom < MODULES_BELOW) return 'modules';
  return zoom < BLOCKS_BELOW ? 'blocks' : 'all';
};

/** The graph as one detail shows it. */
export interface GraphInDetail {
  /** Drawn, in their places, but out of sight. */
  unseen: ReadonlySet<string>;
  /** The frames with nothing seen inside them. */
  hollow: ReadonlySet<string>;
  /** The relations as they are drawn: each end moved up to what is seen of it. */
  relations: DrawnRelation[];
}

const NONE: ReadonlySet<string> = new Set();

/**
 * What a detail shows of the graph. Short of all of it, a behavior drawn
 * inside a frame is unseen — one standing on its own has nowhere to step
 * back into — and, with only modules left, so is all a module holds but
 * the modules inside it. Each relation then runs from what is still seen
 * of each of its ends — the end itself, or the nearest frame round it in
 * sight: a behavior's block, then a block's module; once a kind for each
 * pair, and not at all between ends that come to the same frame, or to one
 * inside the other.
 */
export function graphInDetail(
  graph: ExplorationGraph,
  detail: Detail,
): GraphInDetail {
  if (detail === 'all')
    return { unseen: NONE, hollow: NONE, relations: graph.relations };
  const byId = byIdOf(graph.elements);
  /** An element and each frame round it, from the inside out. */
  const outwardsFrom = (id: string): DrawnElement[] => {
    const way: DrawnElement[] = [];
    for (let at = byId.get(id); at !== undefined;) {
      way.push(at);
      at = at.parent === null ? undefined : byId.get(at.parent);
    }
    return way;
  };

  const unseen = new Set<string>();
  for (const element of graph.elements) {
    const [, ...round] = outwardsFrom(element.id);
    const inFrame = round.length > 0;
    const inModule = round.some(({ kind }) => kind === 'module');
    if (
      (element.kind === 'behavior' && inFrame) ||
      (detail === 'modules' && element.kind !== 'module' && inModule)
    )
      unseen.add(element.id);
  }

  const holding = new Set<string>();
  const holdingSeen = new Set<string>();
  for (const { id, parent } of graph.elements) {
    if (parent === null) continue;
    holding.add(parent);
    if (!unseen.has(id)) holdingSeen.add(parent);
  }
  const hollow = new Set([...holding].filter((id) => !holdingSeen.has(id)));

  /** Where a relation's end is drawn: the end, or the nearest frame round it in sight. */
  const endOf = (id: string): string | undefined =>
    outwardsFrom(id).find((each) => !unseen.has(each.id))?.id;
  const inside = (id: string, around: string) =>
    outwardsFrom(id).some((each) => each.id === around);

  const relations = new Map<string, DrawnRelation>();
  for (const { kind, source, target } of graph.relations) {
    const from = endOf(source);
    const to = endOf(target);
    if (from === undefined || to === undefined) continue;
    // The same frame, or one inside the other: nothing to draw between.
    if (inside(from, to) || inside(to, from)) continue;
    const id = drawnIdOf(kind, from, to);
    if (!relations.has(id))
      relations.set(id, { id, kind, source: from, target: to });
  }
  return { unseen, hollow, relations: [...relations.values()] };
}
