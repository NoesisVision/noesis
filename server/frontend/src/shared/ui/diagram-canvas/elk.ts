import type { ElkNode } from 'elkjs/lib/elk.bundled.js';

type Elk = { layout: (graph: ElkNode) => Promise<ElkNode> };

let elk: Promise<Elk> | null = null;

/** ELK, the layout engine every diagram is laid out with: large, so loaded the first time one is laid out, once for all. */
export const elkOf = (): Promise<Elk> =>
  (elk ??= import('elkjs/lib/elk.bundled.js').then(
    ({ default: ELK }) => new ELK(),
  ));
