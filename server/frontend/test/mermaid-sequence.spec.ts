import { describe, expect, it } from 'bun:test';
import {
  type MermaidSequenceDb,
  sequenceOf,
} from '../src/shared/ui/mermaid-canvas/mermaid-sequence';

/* A fixture in the shape mermaid 12's sequence parser keeps (`diagram.db`). */
const LINETYPE = {
  SOLID: 0,
  DOTTED: 1,
  NOTE: 2,
  SOLID_CROSS: 3,
  SOLID_OPEN: 5,
  LOOP_START: 10,
  LOOP_END: 11,
  ALT_START: 12,
  ALT_ELSE: 13,
  ALT_END: 14,
  SOLID_POINT: 24,
};
const PLACEMENT = { LEFTOF: 0, RIGHTOF: 1, OVER: 2 };

function dbOf(
  actors: Record<string, { description?: string; type?: string }>,
  messages: ReturnType<MermaidSequenceDb['getMessages']>,
): MermaidSequenceDb {
  return {
    getActorKeys: () => Object.keys(actors),
    getActor: (id) => actors[id],
    getMessages: () => messages,
    LINETYPE,
    PLACEMENT,
  };
}

/** Every word as wide as ten pixels a letter, so the test sees the layout's own sums. */
const measure = (text: string) => text.length * 10;

describe('a mermaid sequence diagram on the canvas', () => {
  const drawn = sequenceOf(
    dbOf(
      {
        QM: { description: 'Quality manager', type: 'actor' },
        S: { description: 'Service', type: 'participant' },
      },
      [
        { from: 'QM', to: 'S', message: 'createQDoc(command)', type: 0 },
        { message: 'each recipient', type: 10 },
        { from: 'S', to: 'S', message: 'check', type: 0 },
        { message: '', type: 11 },
        { message: 'ok', type: 12 },
        { from: 'S', to: 'QM', message: 'async', type: 24 },
        { message: 'failed', type: 13 },
        { from: 'S', to: 'QM', message: 'stop', type: 3 },
        { message: '', type: 14 },
        { from: 'QM', to: 'S', message: 'a note', type: 2, placement: 2 },
        { from: 'S', to: 'QM', message: 'QDocId', type: 1 },
      ],
    ),
    measure,
  )!;

  it('draws each participant, an actor as one, with a lifeline to the foot', () => {
    const participants = drawn.graph.boxes.filter(({ id }) =>
      id.startsWith('p:'),
    );
    expect(
      participants.map(({ id, shape, lines }) => [id, shape, lines]),
    ).toEqual([
      ['p:QM', 'actor', ['Quality manager']],
      ['p:S', 'box', ['Service']],
    ]);
    const lifelines = drawn.graph.lines.filter(({ id }) =>
      id.startsWith('lifeline'),
    );
    expect(lifelines.map(({ source, pattern }) => [source, pattern])).toEqual([
      ['p:QM', 'dashed'],
      ['p:S', 'dashed'],
    ]);
  });

  it('draws the messages in their order down the page, each line as mermaid writes it', () => {
    const messages = drawn.graph.lines.filter(({ id }) =>
      id.startsWith('message'),
    );
    expect(
      messages.map(({ label, pattern, targetEnd }) => [
        label,
        pattern,
        targetEnd,
      ]),
    ).toEqual([
      ['createQDoc(command)', 'solid', 'arrow'],
      ['check', 'solid', 'arrow'],
      ['async', 'solid', 'openArrow'],
      ['stop', 'solid', 'cross'],
      ['QDocId', 'dotted', 'arrow'],
    ]);
    const tops = messages.map(
      ({ id }) =>
        drawn.layout.lines.find((line) => line.id === id)!.points[0]!.y,
    );
    expect([...tops].sort((a, b) => a - b)).toEqual(tops);
    // A message to itself loops out and back to its own lifeline.
    const self = drawn.layout.lines.find(
      (line) => line.id === messages[1]!.id,
    )!;
    expect(self.points).toHaveLength(4);
    expect(self.points[0]!.x).toBe(self.points.at(-1)!.x);
  });

  it('plays its messages, not its notes or lifelines, in their order', () => {
    const messages = drawn.graph.lines
      .filter(({ id }) => id.startsWith('message'))
      .map(({ id }) => id);
    expect(drawn.graph.steps).toEqual(messages);
    expect(drawn.graph.steps).toHaveLength(5);
  });

  it('spaces the lifelines so the widest message between them fits', () => {
    const [qm, s] = ['p:QM', 'p:S'].map((id) => drawn.layout.rects.get(id)!);
    const centres = [qm!, s!].map((rect) => rect.x + rect.width / 2);
    expect(centres[1]! - centres[0]!).toBeGreaterThanOrEqual(
      'createQDoc(command)'.length * 10,
    );
  });

  it('frames each block and each of its sections, and draws a note', () => {
    expect(drawn.graph.frames.map(({ title }) => title)).toEqual([
      'loop · each recipient',
      'alt · ok',
      'else · failed',
    ]);
    const [alt, otherwise] = ['block-1', 'block-2'].map((id) =>
      drawn.layout.rects.get(id)!,
    );
    // The else section starts where the alt section ends.
    expect(otherwise!.y).toBe(alt!.y + alt!.height);
    expect(
      drawn.graph.boxes.find(({ shape }) => shape === 'note')?.lines,
    ).toEqual(['a note']);
  });

  it('leaves a diagram with no participants to mermaid', () => {
    expect(sequenceOf(dbOf({}, []), measure)).toBeNull();
  });
});
