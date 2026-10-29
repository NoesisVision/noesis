import type {
  DiagramBox,
  DiagramFrame,
  DiagramGraph,
  DiagramLine,
  LineEnd,
} from './mermaid-graph.ts';
import { linesOf } from './mermaid-graph.ts';
import type {
  DiagramLayout,
  Measure,
  PlacedLine,
  Rect,
} from './mermaid-layout.ts';

/*
 * A mermaid sequence diagram as the canvas draws it: its participants along
 * the top, a dashed lifeline down from each, its messages in their order down
 * the page, its notes beside or over the lifelines, and each `loop`, `alt`,
 * `opt`… block — each of its sections — a frame round what it holds. Not a
 * graph, so laid out here rather than by ELK, into the same boxes, frames and
 * lines the other diagrams are drawn from. Activations and autonumbers are
 * not drawn.
 *
 * As with the other diagrams, everything read of mermaid's parser is named in
 * `MermaidSequenceDb` and nowhere else.
 */

export interface MermaidSequenceDb {
  getActorKeys: () => string[];
  getActor: (id: string) => { description?: string; type?: string } | undefined;
  getMessages: () => {
    from?: string;
    to?: string;
    message?: string;
    type?: number;
    placement?: number;
  }[];
  LINETYPE: Record<string, number>;
  PLACEMENT: Record<string, number>;
}

const FONT = '600 13px "Raleway Variable", sans-serif';
const SMALL = '600 11px "Raleway Variable", sans-serif';
const BOX = { height: 40, padX: 16, min: 96, icon: 22 };
const GAP = 40;
const ROW = 48;
const SELF = { out: 36, drop: 24, row: 64 };
const NOTE_PAD = 10;
const BLOCK = { head: 30, end: 14, pad: 20, nest: 12 };
const ANCHOR = 'end';

type Block = {
  kind: string;
  label: string;
  top: number;
  columns: Set<number>;
  self: boolean;
  depth: number;
  section: number;
};

const BLOCK_STARTS: Record<string, string> = {
  LOOP_START: 'loop',
  ALT_START: 'alt',
  OPT_START: 'opt',
  PAR_START: 'par',
  PAR_OVER_START: 'par',
  CRITICAL_START: 'critical',
  BREAK_START: 'break',
  RECT_START: '',
};
const BLOCK_SECTIONS: Record<string, string> = {
  ALT_ELSE: 'else',
  PAR_AND: 'and',
  CRITICAL_OPTION: 'option',
};
const BLOCK_ENDS = new Set([
  'LOOP_END',
  'ALT_END',
  'OPT_END',
  'PAR_END',
  'CRITICAL_END',
  'BREAK_END',
  'RECT_END',
]);

/** How a message's line looks, by mermaid's name for its kind. */
function lineOf(name: string): {
  pattern: DiagramLine['pattern'];
  source: LineEnd;
  target: LineEnd;
} {
  const pattern = name.includes('DOTTED') ? 'dotted' : 'solid';
  if (name.startsWith('BIDIRECTIONAL'))
    return { pattern, source: 'arrow', target: 'arrow' };
  if (name.endsWith('_CROSS'))
    return { pattern, source: 'none', target: 'cross' };
  if (name.endsWith('_OPEN'))
    return { pattern, source: 'none', target: 'none' };
  if (name.endsWith('_POINT'))
    return { pattern, source: 'none', target: 'openArrow' };
  return { pattern, source: 'none', target: 'arrow' };
}

/** The sequence diagram laid out, as boxes, frames and lines for the canvas. */
export function sequenceOf(
  db: MermaidSequenceDb,
  measure: Measure,
): { graph: DiagramGraph; layout: DiagramLayout } | null {
  const ids = db.getActorKeys();
  if (ids.length === 0) return null;
  const typeName = new Map(
    Object.entries(db.LINETYPE).map(([name, value]) => [value, name]),
  );
  const placementName = new Map(
    Object.entries(db.PLACEMENT).map(([name, value]) => [value, name]),
  );
  const column = new Map(ids.map((id, index) => [id, index]));
  const labels = ids.map((id) => linesOf(db.getActor(id)?.description ?? id));
  const isActor = ids.map((id) => db.getActor(id)?.type === 'actor');
  // An actor's box has a person beside its name, as wide as the icon and its gap.
  const widths = labels.map((lines, index) =>
    Math.max(
      BOX.min,
      ...lines.map(
        (line) =>
          measure(line, FONT) + 2 * BOX.padX + (isActor[index] ? BOX.icon : 0),
      ),
    ),
  );
  const messages = db.getMessages();

  // Columns spaced so the boxes and every message's words fit between the
  // lifelines it joins: a message's span grows to its label, pushing the
  // columns after it right.
  const centre = [widths[0]! / 2];
  for (let index = 1; index < ids.length; index++)
    centre.push(
      centre[index - 1]! + widths[index - 1]! / 2 + GAP + widths[index]! / 2,
    );
  for (const message of messages) {
    const name = typeName.get(message.type ?? -1) ?? '';
    if (message.from === undefined || message.to === undefined) continue;
    const a = column.get(message.from);
    const b = column.get(message.to);
    if (a === undefined || b === undefined) continue;
    const needed =
      (name === 'NOTE'
        ? measure(message.message ?? '', FONT)
        : measure(message.message ?? '', SMALL)) + 48;
    if (a === b) {
      // A message to itself, or a note beside one lifeline, needs room to the right.
      const next = a + 1;
      if (next < ids.length) {
        const room = centre[next]! - centre[a]! - widths[next]! / 2;
        if (room < needed + SELF.out) {
          const push = needed + SELF.out - room;
          for (let index = next; index < ids.length; index++)
            centre[index]! += push;
        }
      }
      continue;
    }
    const [lo, hi] = a < b ? [a, b] : [b, a];
    const span = centre[hi]! - centre[lo]!;
    if (span < needed) {
      const push = needed - span;
      for (let index = hi; index < ids.length; index++) centre[index]! += push;
    }
  }

  const boxes: DiagramBox[] = [];
  const frames: DiagramFrame[] = [];
  const lines: DiagramLine[] = [];
  const rects = new Map<string, Rect & { depth: number }>();
  const placed: PlacedLine[] = [];
  const box = (
    part: Omit<
      DiagramBox,
      'annotations' | 'members' | 'methods' | 'attributes'
    >,
  ) =>
    boxes.push({
      annotations: [],
      members: [],
      methods: [],
      attributes: [],
      ...part,
    });

  ids.forEach((id, index) => {
    const actor = isActor[index];
    box({
      id: `p:${id}`,
      shape: actor ? 'actor' : 'box',
      lines: labels[index]!,
      parent: null,
    });
    rects.set(`p:${id}`, {
      x: centre[index]! - widths[index]! / 2,
      y: 0,
      width: widths[index]!,
      height: BOX.height,
      depth: 0,
    });
  });

  let y = BOX.height + 28;
  const open: Block[] = [];
  let blocks = 0;
  const closeSection = (block: Block, bottom: number) => {
    const id = `block-${blocks++}`;
    const columns = [...block.columns];
    const lo = columns.length === 0 ? 0 : Math.min(...columns);
    const hi = columns.length === 0 ? ids.length - 1 : Math.max(...columns);
    const inset = BLOCK.pad;
    const left =
      centre[lo]! - widths[lo]! / 2 - inset + block.depth * BLOCK.nest;
    const right =
      centre[hi]! +
      Math.max(widths[hi]! / 2, block.self ? SELF.out + 60 : 0) +
      inset -
      block.depth * BLOCK.nest;
    frames.push({
      id,
      title: [block.kind, block.label]
        .filter((part) => part !== '')
        .join(' · '),
      parent: null,
    });
    rects.set(id, {
      x: left,
      y: block.top,
      width: Math.max(80, right - left),
      height: bottom - block.top,
      depth: block.depth,
    });
  };
  const touch = (...cols: number[]) => {
    for (const block of open) for (const col of cols) block.columns.add(col);
  };

  for (const [index, message] of messages.entries()) {
    const name = typeName.get(message.type ?? -1) ?? '';
    if (name in BLOCK_STARTS) {
      open.push({
        kind: BLOCK_STARTS[name]!,
        label: linesOf(message.message).join(' '),
        top: y,
        columns: new Set(),
        self: false,
        depth: open.length,
        section: 0,
      });
      y += BLOCK.head;
      continue;
    }
    if (name in BLOCK_SECTIONS) {
      const block = open.at(-1);
      if (block === undefined) continue;
      closeSection(block, y);
      block.top = y;
      block.kind = BLOCK_SECTIONS[name]!;
      block.label = linesOf(message.message).join(' ');
      block.section++;
      y += BLOCK.head;
      continue;
    }
    if (BLOCK_ENDS.has(name)) {
      const block = open.pop();
      if (block === undefined) continue;
      y += BLOCK.end - 6;
      closeSection(block, y);
      // What the block held, its frame's room included, belongs to the one round it.
      for (const outer of open)
        for (const col of block.columns) outer.columns.add(col);
      y += BLOCK.end;
      continue;
    }
    if (message.from === undefined || message.to === undefined) continue;
    const a = column.get(message.from);
    const b = column.get(message.to);
    if (a === undefined || b === undefined) continue;

    if (name === 'NOTE') {
      const words = linesOf(message.message);
      const width =
        Math.max(...words.map((line) => measure(line, FONT)), 40) +
        2 * NOTE_PAD +
        8;
      const height = words.length * 18 + 2 * NOTE_PAD;
      const where = placementName.get(message.placement ?? -1);
      const [lo, hi] = a <= b ? [a, b] : [b, a];
      const x =
        where === 'LEFTOF'
          ? centre[lo]! - 16 - width
          : where === 'RIGHTOF'
            ? centre[lo]! + 16
            : lo === hi
              ? centre[lo]! - width / 2
              : centre[lo]! - 24;
      const spanWidth =
        where === 'OVER' && lo !== hi ? centre[hi]! - centre[lo]! + 48 : width;
      const id = `note-${index}`;
      box({ id, shape: 'note', lines: words, parent: null });
      rects.set(id, {
        x,
        y,
        width: Math.max(width, spanWidth),
        height,
        depth: 0,
      });
      touch(lo, hi);
      if (where === 'RIGHTOF') for (const block of open) block.self = true;
      y += height + 16;
      continue;
    }

    const { pattern, source, target } = lineOf(name);
    const text = linesOf(message.message).join(' ');
    const id = `message-${index}`;
    lines.push({
      id,
      source: `p:${message.from}`,
      target: `p:${message.to}`,
      label: text === '' ? null : text,
      sourceLabel: null,
      targetLabel: null,
      pattern,
      thick: false,
      sourceEnd: source,
      targetEnd: target,
    });
    const labelWidth = text === '' ? 0 : measure(text, SMALL) + 16;
    touch(a, b);
    if (a === b) {
      const x = centre[a]!;
      const top = y + 10;
      placed.push({
        id,
        points: [
          { x, y: top },
          { x: x + SELF.out, y: top },
          { x: x + SELF.out, y: top + SELF.drop },
          { x, y: top + SELF.drop },
        ],
        label:
          text === ''
            ? null
            : {
                x: x + SELF.out + 8,
                y: top + SELF.drop / 2 - 10,
                width: labelWidth,
                height: 20,
              },
        sourceLabel: null,
        targetLabel: null,
      });
      for (const block of open) block.self = true;
      y += SELF.row;
      continue;
    }
    const lineY = y + 26;
    const from = centre[a]!;
    const to = centre[b]!;
    placed.push({
      id,
      points: [
        { x: from, y: lineY },
        { x: to, y: lineY },
      ],
      label:
        text === ''
          ? null
          : {
              x: (from + to) / 2 - labelWidth / 2,
              y: lineY - 24,
              width: labelWidth,
              height: 20,
            },
      sourceLabel: null,
      targetLabel: null,
    });
    y += ROW;
  }
  // A block left open by a diagram that never closes it still gets its frame.
  while (open.length > 0) closeSection(open.pop()!, y);

  // Each lifeline: dashed, from its box to the foot of the diagram; drawn
  // first, under the messages, in the participants' order.
  const foot = y + 12;
  const lifelines: DiagramLine[] = [];
  const lifelinesPlaced: PlacedLine[] = [];
  ids.forEach((id, index) => {
    const anchor = `${ANCHOR}:${id}`;
    box({ id: anchor, shape: 'point', lines: [], parent: null });
    rects.set(anchor, {
      x: centre[index]! - 1,
      y: foot,
      width: 2,
      height: 2,
      depth: 0,
    });
    const lifeline = `lifeline-${index}`;
    lifelines.push({
      id: lifeline,
      source: `p:${id}`,
      target: anchor,
      label: null,
      sourceLabel: null,
      targetLabel: null,
      pattern: 'dashed',
      thick: false,
      sourceEnd: 'none',
      targetEnd: 'none',
    });
    lifelinesPlaced.push({
      id: lifeline,
      points: [
        { x: centre[index]!, y: BOX.height },
        { x: centre[index]!, y: foot },
      ],
      label: null,
      sourceLabel: null,
      targetLabel: null,
    });
  });
  lines.unshift(...lifelines);
  placed.unshift(...lifelinesPlaced);

  // Everything shifted right of any note or frame that starts left of 0.
  const all = [...rects.values()];
  const left = Math.min(0, ...all.map((rect) => rect.x)) - 8;
  const right = Math.max(...all.map((rect) => rect.x + rect.width)) + 8;
  for (const rect of rects.values()) rect.x -= left;
  for (const line of placed) {
    for (const point of line.points) point.x -= left;
    if (line.label !== null) line.label.x -= left;
  }
  return {
    graph: { kind: 'sequence', direction: 'DOWN', boxes, frames, lines },
    layout: { width: right - left, height: foot + 8, rects, lines: placed },
  };
}
