/*
 * A mermaid diagram as a graph the app draws itself: its boxes, the frames
 * they sit in, and the lines between them, read from what mermaid's own
 * parser hands its layout (`diagram.db.getData()`). Only the diagrams that
 * are graphs are read — flowcharts, state, class and entity-relationship
 * diagrams; any other is left to mermaid to draw.
 *
 * Mermaid's parser data is not a public contract, so everything this reads
 * of it is named in the `Mermaid*` types below and nowhere else: a mermaid
 * upgrade that moves it breaks here, under test, and not across the app.
 * What a diagram says of its looks — `style`, `classDef`, links — is not
 * read: every diagram is drawn in the app's own colours.
 */

/** The diagrams drawn as a graph, by the type mermaid's parser names. */
const GRAPH_TYPES = {
  flowchart: 'flowchart',
  'flowchart-v2': 'flowchart',
  'flowchart-elk': 'flowchart',
  stateDiagram: 'state',
  classDiagram: 'class',
  er: 'er',
} as const satisfies Record<string, DiagramKind>;

export type DiagramKind = 'flowchart' | 'state' | 'class' | 'er' | 'sequence';

/** How a box is drawn. */
type BoxShape =
  | 'box'
  | 'actor'
  | 'point'
  | 'pill'
  | 'diamond'
  | 'database'
  | 'circle'
  | 'start'
  | 'end'
  | 'bar'
  | 'note'
  | 'class'
  | 'entity';

/** How a line ends at a box. */
export type LineEnd =
  | 'none'
  | 'arrow'
  | 'openArrow'
  | 'circle'
  | 'cross'
  | 'triangle'
  | 'diamond'
  | 'filledDiamond'
  | 'one'
  | 'zeroOrOne'
  | 'oneOrMore'
  | 'zeroOrMore';

interface EntityAttribute {
  type: string;
  name: string;
  keys: string[];
  comment: string;
}

export interface DiagramBox {
  id: string;
  shape: BoxShape;
  /** Its words, a line each; none for a start or end dot, or a bar. */
  lines: string[];
  /** The frame it sits in. */
  parent: string | null;
  /** A class's stereotypes, `<<interface>>`, over its name. */
  annotations: string[];
  /** A class's attributes, then its methods, as mermaid writes them. */
  members: string[];
  methods: string[];
  /** An entity's attributes. */
  attributes: EntityAttribute[];
}

export interface DiagramFrame {
  id: string;
  title: string;
  parent: string | null;
}

export interface DiagramLine {
  id: string;
  source: string;
  target: string;
  label: string | null;
  /** The words by either end: a class relation's multiplicities. */
  sourceLabel: string | null;
  targetLabel: string | null;
  pattern: 'solid' | 'dotted' | 'dashed';
  thick: boolean;
  sourceEnd: LineEnd;
  targetEnd: LineEnd;
}

type DiagramDirection = 'DOWN' | 'UP' | 'RIGHT' | 'LEFT';

export interface DiagramGraph {
  kind: DiagramKind;
  direction: DiagramDirection;
  boxes: DiagramBox[];
  frames: DiagramFrame[];
  lines: DiagramLine[];
  /**
   * The lines a diagram plays through, in order, for a diagram that has an
   * order to play: a sequence diagram's messages.
   */
  steps?: string[];
}

/* --- What is read of mermaid's parser data -------------------------------- */

interface MermaidMember {
  getDisplayDetails?: () => { displayText: string };
  text?: string;
}

interface MermaidNode {
  id: string;
  label?: string;
  shape?: string;
  parentId?: string;
  isGroup: boolean;
  annotations?: string[];
  members?: MermaidMember[];
  methods?: MermaidMember[];
  attributes?: {
    type: string;
    name: string;
    keys?: string[];
    comment?: string;
  }[];
}

interface MermaidEdge {
  id?: string;
  start?: string;
  end?: string;
  label?: string | null;
  startLabelRight?: string;
  startLabelLeft?: string;
  endLabelLeft?: string;
  endLabelRight?: string;
  pattern?: string;
  thickness?: string;
  arrowTypeStart?: string;
  arrowTypeEnd?: string;
}

export interface MermaidDiagramData {
  type: string;
  direction?: string;
  nodes: MermaidNode[];
  edges: MermaidEdge[];
}

/** The kind of graph a parsed diagram is, or none when mermaid should draw it. */
export function graphKindOf(type: string): DiagramKind | null {
  return Object.hasOwn(GRAPH_TYPES, type)
    ? GRAPH_TYPES[type as keyof typeof GRAPH_TYPES]
    : null;
}

const SHAPES: Record<string, BoxShape> = {
  stadium: 'pill',
  diamond: 'diamond',
  question: 'diamond',
  rhombus: 'diamond',
  decision: 'diamond',
  choice: 'diamond',
  cylinder: 'database',
  cyl: 'database',
  'lin-cyl': 'database',
  'h-cyl': 'database',
  'horizontal-cylinder': 'database',
  database: 'database',
  db: 'database',
  das: 'database',
  circle: 'circle',
  circ: 'circle',
  doublecircle: 'circle',
  'dbl-circ': 'circle',
  'sm-circ': 'circle',
  stateStart: 'start',
  stateEnd: 'end',
  fork: 'bar',
  join: 'bar',
  note: 'note',
  classBox: 'class',
  erBox: 'entity',
};

const ENDS: Record<string, LineEnd> = {
  arrow_point: 'arrow',
  arrow_barb: 'arrow',
  arrow_circle: 'circle',
  arrow_cross: 'cross',
  extension: 'triangle',
  composition: 'filledDiamond',
  aggregation: 'diamond',
  dependency: 'openArrow',
  lollipop: 'circle',
  only_one: 'one',
  zero_or_one: 'zeroOrOne',
  one_or_more: 'oneOrMore',
  zero_or_more: 'zeroOrMore',
};

const DIRECTIONS: Record<string, DiagramDirection> = {
  TB: 'DOWN',
  TD: 'DOWN',
  BT: 'UP',
  LR: 'RIGHT',
  RL: 'LEFT',
};

/** A label's words as they read: mermaid's line breaks kept, its marks taken off. */
export function linesOf(label: string | undefined | null): string[] {
  if (label === undefined || label === null) return [];
  return label
    .replaceAll(/<br\s*\/?>/giu, '\n')
    .replaceAll(/<[^>]+>/gu, '')
    .replaceAll('&lt;', '<')
    .replaceAll('&gt;', '>')
    .replaceAll('&quot;', '"')
    .replaceAll('&#39;', "'")
    .replaceAll('&amp;', '&')
    .replaceAll(/\*\*|__|`/gu, '')
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line !== '');
}

const memberText = (member: MermaidMember) =>
  (member.getDisplayDetails?.().displayText ?? member.text ?? '')
    .replaceAll('\\', '')
    .replaceAll('&lt;', '<')
    .replaceAll('&gt;', '>');

/** What mermaid's parser made of a graph diagram, as the app draws it. */
export function graphOf(data: MermaidDiagramData): DiagramGraph | null {
  const kind = graphKindOf(data.type);
  if (kind === null) return null;
  // A state diagram's note sits in a group of its own with the state it is
  // about: the group is mermaid's way of placing it, not part of the diagram.
  const noteGroups = new Map(
    data.nodes
      .filter((node) => node.shape === 'noteGroup')
      .map((node) => [node.id, node.parentId ?? null]),
  );
  const parentOf = (node: MermaidNode): string | null => {
    const parent = node.parentId ?? null;
    return parent !== null && noteGroups.has(parent)
      ? (noteGroups.get(parent) ?? null)
      : parent;
  };
  const frames: DiagramFrame[] = [];
  const boxes: DiagramBox[] = [];
  for (const node of data.nodes) {
    if (noteGroups.has(node.id)) continue;
    if (node.isGroup) {
      frames.push({
        id: node.id,
        title: linesOf(node.label).join(' '),
        parent: parentOf(node),
      });
      continue;
    }
    const shape = SHAPES[node.shape ?? ''] ?? 'box';
    boxes.push({
      id: node.id,
      shape,
      lines:
        shape === 'start' || shape === 'end' || shape === 'bar'
          ? []
          : linesOf(node.label ?? node.id),
      parent: parentOf(node),
      annotations: node.annotations ?? [],
      members: (node.members ?? []).map(memberText),
      methods: (node.methods ?? []).map(memberText),
      attributes: (node.attributes ?? []).map((attribute) => ({
        type: attribute.type,
        name: attribute.name,
        keys: attribute.keys ?? [],
        comment: attribute.comment ?? '',
      })),
    });
  }
  const drawn = new Set([...boxes, ...frames].map(({ id }) => id));
  const lines: DiagramLine[] = [];
  for (const [index, edge] of data.edges.entries()) {
    if (edge.start === undefined || edge.end === undefined) continue;
    if (!drawn.has(edge.start) || !drawn.has(edge.end)) continue;
    const label = linesOf(edge.label).join(' ');
    const sourceLabel = edge.startLabelRight || edge.startLabelLeft || null;
    const targetLabel = edge.endLabelLeft || edge.endLabelRight || null;
    lines.push({
      id: `line-${index}`,
      source: edge.start,
      target: edge.end,
      label: label === '' ? null : label,
      sourceLabel,
      targetLabel,
      pattern:
        edge.pattern === 'dotted' || edge.thickness === 'dotted'
          ? 'dotted'
          : edge.pattern === 'dashed'
            ? 'dashed'
            : 'solid',
      thick: edge.thickness === 'thick',
      sourceEnd: ENDS[edge.arrowTypeStart ?? ''] ?? 'none',
      targetEnd: ENDS[edge.arrowTypeEnd ?? ''] ?? 'none',
    });
  }
  return {
    kind,
    direction: DIRECTIONS[data.direction ?? 'TB'] ?? 'DOWN',
    boxes,
    frames,
    lines,
  };
}
