import type { ElkNode, LayoutOptions } from 'elkjs/lib/elk.bundled.js';
import { byIdOf } from '#/shared/collections.ts';
import { elkOf } from '#/shared/ui/diagram-canvas/elk.ts';
import type {
  Badge,
  DrawnElement,
  ExplorationGraph,
} from '../../system-model-exploration.ts';
import { badgeRowsOf, badgeTypeOf } from './badge-rows.ts';

/*
 * Where each element of the exploration stands, placed by one of ELK's
 * algorithms, a container sized around what it holds. Positions are in the
 * canvas's own pixels, a contained element's relative to its container, as
 * React Flow reads them. The relations shape where the cards go; the edges
 * themselves are drawn between the cards wherever they then stand.
 *
 * ELK is large, so it is loaded the first time something is placed.
 */

export type LayoutDirection = 'vertical' | 'horizontal';

export type LayoutAlgorithm = 'layered' | 'tree' | 'force' | 'compact';

export interface Placement {
  /** Containers before what they hold, as React Flow needs a parent first. */
  elements: PlacedElement[];
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

/**
 * A card's height, whatever its name: its name and what it is. The way to
 * what it contains sits on its border, so it needs no room of its own.
 */
export const HEIGHT = 56;
/** Wide enough for a short name beside the card's menu and cross. */
const MIN_WIDTH = 180;
const MAX_WIDTH = 300;
/** About one character of the card's name, with its icon, its padding and the dots and cross beside it. */
export const widthOf = (name: string) =>
  Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, name.length * 7.5 + 116));

/** A frame's least width: its name, inset in the frame, and its menu and two ways off the diagram beside it. */
const frameWidthOf = (name: string) => widthOf(name) + 56;

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

/**
 * Room at the top of a container for its name, and round what it holds;
 * at the bottom enough that the plus on a card's border there and the one
 * on the container's own stand apart.
 */
export interface Padding {
  top: number;
  left: number;
  bottom: number;
  right: number;
}
export const PADDING: Readonly<Padding> = {
  top: 60,
  left: 16,
  bottom: 40,
  right: 16,
};

/*
 * A card that carries badges (slot-badges.module.css): its name and what it
 * is at the top, then its rows of badges, each row a label and as many
 * lines of badges as its width wraps them into. The sizes here are what
 * the stylesheet draws, so ELK leaves each card the room it needs.
 */
/** Where a card's badges start, below its name and what it is. */
const BADGES_TOP = 50;
/** Where a frame's badges start, below its name. */
const FRAME_BADGES_TOP = 52;
/** One line of badges: a badge and the gap under it. */
export const BADGE_LINE = 38;
/** Room under a card's last line of badges, clear of its rounded corners. */
const BADGES_BOTTOM = 10;
/** A row's label, and the gap after it. */
const ROW_LABEL = 52;
/** Room either side of the badges, inside the card. */
const BADGES_INSET = 16;
const BADGE_GAP = 4;
/** About one character of a badge, with its padding and border. */
const badgeWidthOf = (badge: Badge) =>
  Math.max(
    badge.name.length * 6.6,
    // Its type, and the mark after it of a type with a card of its own.
    badgeTypeOf(badge).length * 6.4 + (badge.onDiagram ? 14 : 0),
  ) + 20;
/** The widest a card grows for its badges before they wrap. */
const MAX_BADGED_WIDTH = 380;
const NO_BADGES: readonly Badge[] = [];

/** How many lines a card's badges take at a width: each row wrapped on its own. */
function badgeLinesOf(badges: readonly Badge[], width: number) {
  const room = width - 2 * BADGES_INSET - ROW_LABEL;
  let lines = 0;
  for (const { badges: row } of badgeRowsOf(badges)) {
    let used = Infinity;
    for (const badge of row) {
      const each = Math.min(badgeWidthOf(badge), room);
      if (used + BADGE_GAP + each > room) {
        lines += 1;
        used = each;
      } else used += BADGE_GAP + each;
    }
  }
  return lines;
}

/** As wide as the name needs, and as its longest row of badges would, up to the most. */
const badgedWidthOf = (least: number, badges: readonly Badge[]) =>
  Math.max(
    least,
    Math.min(
      MAX_BADGED_WIDTH,
      Math.max(
        0,
        ...badgeRowsOf(badges).map(
          ({ badges: row }) =>
            2 * BADGES_INSET +
            ROW_LABEL +
            row.reduce((all, badge) => all + badgeWidthOf(badge), 0) +
            BADGE_GAP * (row.length - 1),
        ),
      ),
    ),
  );

type Badges = ExplorationGraph['badges'];
const badgesOf = (badges: Badges, id: string) => badges.get(id) ?? NO_BADGES;

/** A card's size: its name and what it is, and room for its badges under them. */
export function cardSizeOf(element: DrawnElement, badges: Badges) {
  const carried = badgesOf(badges, element.id);
  const width = badgedWidthOf(widthOf(element.name), carried);
  if (carried.length === 0) return { width, height: HEIGHT };
  return {
    width,
    height:
      BADGES_TOP +
      badgeLinesOf(carried, width) * BADGE_LINE -
      BADGE_GAP +
      BADGES_BOTTOM,
  };
}

/** A frame's least width: its name, and its longest row of badges. */
export const frameLeastWidthOf = (element: DrawnElement, badges: Badges) =>
  badgedWidthOf(frameWidthOf(element.name), badgesOf(badges, element.id));

/** A frame's room round what it holds: at the top, its name and its badges. */
export function paddingOf(
  element: DrawnElement,
  badges: Badges,
): Readonly<Padding> {
  const carried = badgesOf(badges, element.id);
  if (carried.length === 0) return PADDING;
  const lines = badgeLinesOf(carried, frameLeastWidthOf(element, badges));
  return {
    ...PADDING,
    top: FRAME_BADGES_TOP + lines * BADGE_LINE - BADGE_GAP + BADGES_BOTTOM,
  };
}

const elkPaddingOf = ({ top, left, bottom, right }: Readonly<Padding>) =>
  `[top=${top},left=${left},bottom=${bottom},right=${right}]`;
/** The room between two cards side by side. */
export const SPACING = 32;

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
      };
    case 'tree':
      return { ...flow, 'elk.algorithm': 'mrtree' };
    case 'force':
      return { 'elk.algorithm': 'force', 'elk.spacing.nodeNode': '64' };
    case 'compact':
      return { 'elk.algorithm': 'rectpacking' };
  }
}

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
      ? { id: element.id, ...cardSizeOf(element, graph.badges) }
      : {
          id: element.id,
          layoutOptions: {
            ...optionsOf(algorithm, direction),
            'elk.padding': elkPaddingOf(paddingOf(element, graph.badges)),
            'elk.nodeSize.minimum': minimumOf(
              frameLeastWidthOf(element, graph.badges),
              HEIGHT,
              direction,
            ),
            'elk.nodeSize.constraints': 'MINIMUM_SIZE',
          },
          children: inside.map(nodeOf),
        };
  };

  const placed = await (
    await elkOf()
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

  const byId = byIdOf(graph.elements);
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
        width: node.width ?? cardSizeOf(element, graph.badges).width,
        height: node.height ?? cardSizeOf(element, graph.badges).height,
      });
      walk(node.children);
    }
  };
  walk(placed.children);
  return { elements: out };
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
      badges: graph.badges,
      folded: graph.folded,
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
