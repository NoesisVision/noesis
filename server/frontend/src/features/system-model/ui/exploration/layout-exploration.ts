import type {
  ElkExtendedEdge,
  ElkNode,
  ElkPoint,
  LayoutOptions,
} from 'elkjs/lib/elk.bundled.js';
import type {
  DrawnElement,
  ExplorationGraph,
} from '../../system-model-exploration.ts';

/*
 * Where each element of the exploration stands, placed by one of ELK's
 * algorithms, a container sized around what it holds. Positions are in the
 * canvas's own pixels, a contained element's relative to its container, as
 * React Flow reads them. Only the layered algorithm routes the edges too —
 * at right angles, around the cards, across containers — so only its
 * placing comes with routes.
 *
 * ELK is large, so it is loaded the first time something is placed.
 */

export type LayoutDirection = 'vertical' | 'horizontal';

export type LayoutAlgorithm = 'layered' | 'tree' | 'force' | 'compact';

/** The points an edge runs through, start to end, by the edge's id. */
export type EdgeRoutes = ReadonlyMap<string, ElkPoint[]>;

export interface Placement {
  /** Containers before what they hold, as React Flow needs a parent first. */
  elements: PlacedElement[];
  routes: EdgeRoutes;
}

export interface PlacedElement {
  element: DrawnElement;
  /** Whether other elements are drawn inside it. */
  holds: boolean;
  x: number;
  y: number;
  width: number;
  height: number;
}

/** A card's height, whatever its name: its name and what it is. */
export const HEIGHT = 56;
/** Room along the bottom of a card, or a frame, for the button bringing what it contains. */
const CONTAINS_ROOM = 34;
/** A card's height: more when it has elements inside it to bring. */
export const heightOf = (element: DrawnElement) =>
  HEIGHT + (element.containsUndrawn ? CONTAINS_ROOM : 0);
/** Wide enough for a short name beside the card's menu and cross. */
const MIN_WIDTH = 180;
const MAX_WIDTH = 300;
/** About one character of the card's name, with its icon, its padding and the dots and cross beside it. */
export const widthOf = (name: string) =>
  Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, name.length * 7.5 + 116));

/** A frame's least width: its name, inset in the frame, and its menu and two ways off the diagram beside it. */
export const frameWidthOf = (name: string) => widthOf(name) + 56;

/**
 * A frame's least size as ELK reads it. Laying out downwards, ELK takes the
 * pair the other way round — width for height — so it is given so.
 */
const minimumOf = (
  width: number,
  height: number,
  direction: LayoutDirection,
) =>
  direction === 'vertical' ? `(${height},${width})` : `(${width},${height})`;

/** Room at the top of a container for its name, and round what it holds. */
export const PADDING = { top: 60, left: 16, bottom: 16, right: 16 } as const;
/** A container's room round what it holds: more at the bottom when it has more to bring. */
export const paddingOf = (element: DrawnElement) => ({
  ...PADDING,
  bottom: PADDING.bottom + (element.containsUndrawn ? CONTAINS_ROOM : 0),
});
const elkPaddingOf = (element: DrawnElement) => {
  const { top, left, bottom, right } = paddingOf(element);
  return `[top=${top},left=${left},bottom=${bottom},right=${right}]`;
};
/** The room between two cards side by side. */
export const SPACING = 32;

let elk: Promise<{ layout: (graph: ElkNode) => Promise<ElkNode> }> | null =
  null;
const loadElk = () => {
  elk ??= import('elkjs/lib/elk.bundled.js').then(
    ({ default: ELK }) => new ELK(),
  );
  return elk;
};

function optionsOf(
  algorithm: LayoutAlgorithm,
  direction: LayoutDirection,
): LayoutOptions {
  const flow = { 'elk.direction': direction === 'vertical' ? 'DOWN' : 'RIGHT' };
  switch (algorithm) {
    case 'layered':
      return {
        ...flow,
        'elk.algorithm': 'layered',
        'elk.edgeRouting': 'ORTHOGONAL',
        'elk.layered.spacing.nodeNodeBetweenLayers': '64',
        // The routes' points in the canvas's pixels, wherever their ends sit.
        'elk.json.edgeCoords': 'ROOT',
      };
    case 'tree':
      return { ...flow, 'elk.algorithm': 'mrtree' };
    case 'force':
      return { 'elk.algorithm': 'force', 'elk.spacing.nodeNode': '64' };
    case 'compact':
      return { 'elk.algorithm': 'rectpacking' };
  }
}

const routeOf = (edge: ElkExtendedEdge): ElkPoint[] | null => {
  const section = edge.sections?.[0];
  return section === undefined
    ? null
    : [section.startPoint, ...(section.bendPoints ?? []), section.endPoint];
};

export async function layoutExploration(
  graph: ExplorationGraph,
  algorithm: LayoutAlgorithm,
  direction: LayoutDirection,
): Promise<Placement> {
  const children = new Map<string | null, DrawnElement[]>();
  for (const element of graph.elements)
    children.set(element.parent, [
      ...(children.get(element.parent) ?? []),
      element,
    ]);

  const nodeOf = (element: DrawnElement): ElkNode => {
    const inside = children.get(element.id) ?? [];
    return inside.length === 0
      ? {
          id: element.id,
          width: widthOf(element.name),
          height: heightOf(element),
        }
      : {
          id: element.id,
          layoutOptions: {
            ...optionsOf(algorithm, direction),
            'elk.padding': elkPaddingOf(element),
            'elk.nodeSize.minimum': minimumOf(
              frameWidthOf(element.name),
              heightOf(element),
              direction,
            ),
            'elk.nodeSize.constraints': 'MINIMUM_SIZE',
          },
          children: inside.map(nodeOf),
        };
  };

  const placed = await (
    await loadElk()
  ).layout({
    id: 'root',
    layoutOptions: {
      'elk.hierarchyHandling': 'INCLUDE_CHILDREN',
      'elk.spacing.nodeNode': String(SPACING),
      'elk.spacing.componentComponent': '48',
      ...optionsOf(algorithm, direction),
    },
    children: (children.get(null) ?? []).map(nodeOf),
    edges: graph.relations.map(({ id, source, target }) => ({
      id,
      sources: [source],
      targets: [target],
    })),
  });

  const byId = new Map(graph.elements.map((element) => [element.id, element]));
  const out: PlacedElement[] = [];
  const walk = (nodes: ElkNode[] = []) => {
    for (const node of nodes) {
      const element = byId.get(node.id);
      if (element === undefined) continue;
      out.push({
        element,
        holds: (node.children?.length ?? 0) > 0,
        x: node.x ?? 0,
        y: node.y ?? 0,
        width: node.width ?? widthOf(element.name),
        height: node.height ?? heightOf(element),
      });
      walk(node.children);
    }
  };
  walk(placed.children);
  const routes = new Map<string, ElkPoint[]>();
  if (algorithm === 'layered')
    for (const edge of placed.edges ?? []) {
      const route = routeOf(edge);
      if (route !== null) routes.set(edge.id, route);
    }
  return { elements: out, routes };
}

/**
 * What one container holds, placed as though nothing else were drawn: its
 * own elements at the top, anything they hold inside them, and the
 * relations among them. Positions of its own elements are from the corner
 * of what they cover, as a container's room for them starts.
 */
export async function layoutWithin(
  graph: ExplorationGraph,
  id: string,
  algorithm: LayoutAlgorithm,
  direction: LayoutDirection,
): Promise<PlacedElement[]> {
  const inside = new Set<string>();
  const gather = (parent: string) => {
    for (const element of graph.elements)
      if (element.parent === parent && !inside.has(element.id)) {
        inside.add(element.id);
        gather(element.id);
      }
  };
  gather(id);
  const { elements } = await layoutExploration(
    {
      elements: graph.elements
        .filter((element) => inside.has(element.id))
        .map((element) =>
          element.parent === id ? { ...element, parent: null } : element,
        ),
      relations: graph.relations.filter(
        ({ source, target }) => inside.has(source) && inside.has(target),
      ),
    },
    algorithm,
    direction,
  );
  const top = elements.filter(({ element }) => element.parent === null);
  const left = Math.min(...top.map(({ x }) => x));
  const up = Math.min(...top.map(({ y }) => y));
  return elements.map((each) =>
    each.element.parent === null
      ? { ...each, x: each.x - left, y: each.y - up }
      : each,
  );
}
