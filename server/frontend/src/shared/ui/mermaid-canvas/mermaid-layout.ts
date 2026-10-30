import type {
  ElkExtendedEdge,
  ElkLabel,
  ElkNode,
} from 'elkjs/lib/elk.bundled.js';
import type { DiagramBox, DiagramGraph } from './mermaid-graph.ts';

/*
 * Where every box, frame and line of a diagram stands, placed by ELK's
 * layered layout as the exploration's cards are: a box sized to its words,
 * a frame round what it holds, every line routed at right angles round the
 * boxes, its words where ELK left room for them. Everything is in the
 * diagram's own coordinates, its top left at 0, 0.
 */

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface Point {
  x: number;
  y: number;
}

export interface PlacedLine {
  id: string;
  points: Point[];
  label: Rect | null;
  sourceLabel: Rect | null;
  targetLabel: Rect | null;
}

export interface DiagramLayout {
  width: number;
  height: number;
  /** Every box and frame, by id; a frame's depth is how many frames hold it. */
  rects: Map<string, Rect & { depth: number }>;
  lines: PlacedLine[];
}

/** How wide a line of words is, in pixels, in a given font. */
export type Measure = (text: string, font: string) => number;

/** The fonts the canvas draws in (mermaid-canvas.module.css). */
const FONTS = {
  label: '600 13px "Raleway Variable", sans-serif',
  row: '12px "Raleway Variable", sans-serif',
  small: '600 11px "Raleway Variable", sans-serif',
} as const;

const LINE_HEIGHT = 18;
const ROW_HEIGHT = 20;
const HEADER_HEIGHT = 34;
const PAD_X = 16;
const PAD_Y = 11;
/** A frame's room for its title over what it holds. */
const FRAME_TOP = 40;
const FRAME_PAD = 16;
const DOT = 20;
const BAR = { long: 72, short: 8 };
const MIN_WIDTH = 64;

/** A box's size, from its words. */
function sizeOf(
  box: DiagramBox,
  measure: Measure,
  across: boolean,
): { width: number; height: number } {
  const widest = (texts: string[], font: string) =>
    Math.max(0, ...texts.map((text) => measure(text, font)));
  const words = widest(box.lines, FONTS.label);
  const text = Math.max(1, box.lines.length) * LINE_HEIGHT;
  switch (box.shape) {
    case 'start':
    case 'end':
      return { width: DOT, height: DOT };
    case 'bar':
      return across
        ? { width: BAR.short, height: BAR.long }
        : { width: BAR.long, height: BAR.short };
    case 'diamond':
      return {
        width: Math.max(80, words * 1.5 + 2 * PAD_X),
        height: Math.max(64, text * 1.8 + 2 * PAD_Y),
      };
    case 'circle': {
      const side = Math.max(56, words + 2 * PAD_X);
      return { width: side, height: side };
    }
    case 'database':
      return {
        width: Math.max(MIN_WIDTH, words + 2 * PAD_X + 22),
        height: text + 2 * PAD_Y,
      };
    case 'class': {
      const rows = [...box.members, ...box.methods];
      const width = Math.max(
        120,
        words + 2 * PAD_X,
        widest(rows, FONTS.row) + 2 * PAD_X,
        widest(
          box.annotations.map((note) => `«${note}»`),
          FONTS.small,
        ) +
          2 * PAD_X,
      );
      const sections =
        (box.members.length > 0 ? 1 : 0) + (box.methods.length > 0 ? 1 : 0);
      return {
        width,
        height:
          HEADER_HEIGHT +
          box.annotations.length * 14 +
          rows.length * ROW_HEIGHT +
          sections * 8,
      };
    }
    case 'entity': {
      const names = widest(
        box.attributes.map(({ name }) => name),
        FONTS.row,
      );
      const types = widest(
        box.attributes.map(({ type }) => type),
        FONTS.row,
      );
      const keys = widest(
        box.attributes.map(({ keys }) => keys.join(', ')),
        FONTS.small,
      );
      return {
        width: Math.max(
          120,
          words + 2 * PAD_X,
          names + types + keys + 2 * PAD_X + 24,
        ),
        height:
          HEADER_HEIGHT +
          box.attributes.length * ROW_HEIGHT +
          (box.attributes.length > 0 ? 8 : 0),
      };
    }
    default:
      return {
        width: Math.max(MIN_WIDTH, words + 2 * PAD_X),
        height: text + 2 * PAD_Y,
      };
  }
}

type Elk = { layout: (graph: ElkNode) => Promise<ElkNode> };
let elk: Promise<Elk> | null = null;
/** ELK is large, so it is loaded the first time a diagram is laid out. */
const elkOf = () =>
  (elk ??= import('elkjs/lib/elk.bundled.js').then(
    ({ default: ELK }) => new ELK(),
  ));

const labelOf = (
  id: string,
  text: string | null,
  measure: Measure,
  placement: 'CENTER' | 'HEAD' | 'TAIL',
): ElkLabel[] =>
  text === null
    ? []
    : [
        {
          id: `${id}:${placement}`,
          text,
          width: measure(text, FONTS.small) + 16,
          height: 20,
          layoutOptions: {
            'elk.edgeLabels.placement': placement,
            // A line's words on it, as the exploration's are; its ends', beside.
            'elk.edgeLabels.inline': String(placement === 'CENTER'),
          },
        },
      ];

/** The diagram laid out, as ELK places it. */
export async function layoutDiagram(
  graph: DiagramGraph,
  measure: Measure,
): Promise<DiagramLayout> {
  const across = graph.direction === 'RIGHT' || graph.direction === 'LEFT';
  const children = new Map<string | null, ElkNode[]>();
  const add = (parent: string | null, node: ElkNode) =>
    children.set(parent, [...(children.get(parent) ?? []), node]);
  for (const box of graph.boxes)
    add(box.parent, { id: box.id, ...sizeOf(box, measure, across) });
  const frameIds = new Set(graph.frames.map(({ id }) => id));
  const frameOf = (id: string): ElkNode => {
    const frame = graph.frames.find((each) => each.id === id);
    return {
      id,
      layoutOptions: {
        'elk.padding': `[top=${FRAME_TOP},left=${FRAME_PAD},bottom=${FRAME_PAD},right=${FRAME_PAD}]`,
        'elk.nodeSize.constraints': 'MINIMUM_SIZE',
        'elk.nodeSize.minimum': `(${
          measure(frame?.title ?? '', FONTS.label) + 2 * FRAME_PAD
        }, ${FRAME_TOP + FRAME_PAD})`,
      },
      children: [
        ...(children.get(id) ?? []),
        ...graph.frames
          .filter((each) => each.parent === id && frameIds.has(each.id))
          .map((each) => frameOf(each.id)),
      ],
    };
  };
  const edges: ElkExtendedEdge[] = graph.lines.map((line) => ({
    id: line.id,
    sources: [line.source],
    targets: [line.target],
    labels: [
      ...labelOf(line.id, line.label, measure, 'CENTER'),
      ...labelOf(line.id, line.sourceLabel, measure, 'TAIL'),
      ...labelOf(line.id, line.targetLabel, measure, 'HEAD'),
    ],
  }));
  const root: ElkNode = {
    id: 'root',
    layoutOptions: {
      'elk.algorithm': 'layered',
      'elk.direction': graph.direction,
      'elk.edgeRouting': 'ORTHOGONAL',
      'elk.hierarchyHandling': 'INCLUDE_CHILDREN',
      'elk.spacing.nodeNode': '36',
      'elk.layered.spacing.nodeNodeBetweenLayers': '56',
      'elk.spacing.edgeLabel': '4',
      'elk.spacing.componentComponent': '48',
      'elk.padding': '[top=8,left=8,bottom=8,right=8]',
      // Every position on the diagram's own grid, whatever holds it.
      'elk.json.shapeCoords': 'ROOT',
      'elk.json.edgeCoords': 'ROOT',
    },
    children: [
      ...(children.get(null) ?? []),
      ...graph.frames
        .filter((frame) => frame.parent === null)
        .map((frame) => frameOf(frame.id)),
    ],
    edges,
  };
  const placed = await (await elkOf()).layout(root);

  const rects = new Map<string, Rect & { depth: number }>();
  const walk = (node: ElkNode, depth: number) => {
    for (const child of node.children ?? []) {
      rects.set(child.id, {
        x: child.x ?? 0,
        y: child.y ?? 0,
        width: child.width ?? 0,
        height: child.height ?? 0,
        depth,
      });
      walk(child, depth + 1);
    }
  };
  walk(placed, 0);

  const allEdges: ElkExtendedEdge[] = [];
  const gather = (node: ElkNode) => {
    allEdges.push(...(node.edges ?? []));
    for (const child of node.children ?? []) gather(child);
  };
  gather(placed);
  const lines = allEdges.map((edge): PlacedLine => {
    const points = (edge.sections ?? []).flatMap((section, index) => [
      ...(index === 0 ? [section.startPoint] : []),
      ...(section.bendPoints ?? []),
      section.endPoint,
    ]);
    const labelAt = (suffix: string): Rect | null => {
      const label = edge.labels?.find(
        ({ id }) => id === `${edge.id}:${suffix}`,
      );
      return label === undefined
        ? null
        : {
            x: label.x ?? 0,
            y: label.y ?? 0,
            width: label.width ?? 0,
            height: label.height ?? 0,
          };
    };
    return {
      id: edge.id,
      points,
      label: labelAt('CENTER'),
      sourceLabel: labelAt('TAIL'),
      targetLabel: labelAt('HEAD'),
    };
  });
  return {
    width: placed.width ?? 0,
    height: placed.height ?? 0,
    rects,
    lines,
  };
}
