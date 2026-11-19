import { describe, expect, it } from 'bun:test';
import type {
  DrawnElement,
  ExplorationGraph,
} from '../src/features/system-model/system-model-exploration';
import {
  layoutByRelations,
  tangleOf,
} from '../src/features/system-model/ui/exploration/layout-by-relations';
import {
  layoutExploration,
  type PlacedElement,
  SPACING,
} from '../src/features/system-model/ui/exploration/layout-exploration';

const card = (id: string, parent: string | null = null): DrawnElement => ({
  id,
  kind: 'building_block',
  name: id,
  pattern: 'aggregate',
  container: parent,
  parent,
});

const graphOf = (
  elements: DrawnElement[],
  joined: [string, string][],
): ExplorationGraph => ({
  elements,
  relations: joined.map(([source, target]) => ({
    id: `invokes:${source}->${target}`,
    kind: 'invokes',
    source,
    target,
  })),
  badges: new Map(),
  folded: new Set(),
  noOutput: new Set(),
  parentless: new Set(),
});

/** Where each stands on the canvas, through each frame round it. */
const onCanvas = (placed: readonly PlacedElement[]) => {
  const at = new Map<string, PlacedElement>();
  for (const each of placed) {
    const round =
      each.element.parent === null ? undefined : at.get(each.element.parent);
    at.set(each.element.id, {
      ...each,
      x: each.x + (round?.x ?? 0),
      y: each.y + (round?.y ?? 0),
    });
  }
  return at;
};

describe('placing the exploration by its relations', () => {
  it('places by kinds, as the other placing does, when nothing is joined', () => {
    const graph = graphOf([card('A'), card('B'), card('C')], []);
    expect(layoutByRelations(graph)).toEqual(layoutExploration(graph));
  });

  it('sets two crossing edges side by side instead', () => {
    // Two by two as they come, the edges are the square's two diagonals.
    const graph = graphOf(
      [card('A'), card('B'), card('C'), card('D')],
      [
        ['A', 'D'],
        ['B', 'C'],
      ],
    );
    expect(tangleOf(graph, layoutExploration(graph).elements).crossings).toBe(
      1,
    );
    const placed = layoutByRelations(graph).elements;
    expect(tangleOf(graph, placed)).toMatchObject({ crossings: 0, through: 0 });
    expect(placed).toHaveLength(4);
  });

  it('takes an edge out from through the card between its ends', () => {
    // One under another as they come, A reaches C through B.
    const graph = graphOf([card('A'), card('B'), card('C')], [['A', 'C']]);
    expect(tangleOf(graph, layoutExploration(graph).elements).through).toBe(1);
    const at = onCanvas(layoutByRelations(graph).elements);
    expect(tangleOf(graph, [...at.values()]).through).toBe(0);
    // Now next to each other, the room between them as between any two.
    const [a, c] = [at.get('A')!, at.get('C')!];
    const between = Math.max(
      Math.abs(a.x - c.x) - a.width,
      Math.abs(a.y - c.y) - a.height,
    );
    expect(between).toBe(SPACING);
  });

  it('reads a relation between what two frames hold as one between the frames', () => {
    const frames = ['One', 'Two', 'Three'].map((name) => card(name));
    const held = frames.map(({ id }) => card(`${id}.does`, id));
    // What the first frame holds reaches what the last one does.
    const graph = graphOf([...frames, ...held], [['One.does', 'Three.does']]);
    const placed = layoutByRelations(graph).elements;
    expect(tangleOf(graph, placed)).toMatchObject({ through: 0, crossings: 0 });
    // The two frames stand next to each other: nothing between what they hold.
    const at = onCanvas(placed);
    const [one, three] = [at.get('One')!, at.get('Three')!];
    expect(
      Math.max(
        Math.abs(one.x - three.x) - one.width,
        Math.abs(one.y - three.y) - one.height,
      ),
    ).toBe(SPACING);
    // Each frame still before what it holds, and that inside it.
    const ids = placed.map(({ element }) => element.id);
    for (const { id } of frames)
      expect(ids.indexOf(id)).toBeLessThan(ids.indexOf(`${id}.does`));
  });

  it('untangles no worse than it began, however it ends', () => {
    // A ring of six with its chords: no order clears every crossing.
    const names = ['A', 'B', 'C', 'D', 'E', 'F'];
    const graph = graphOf(
      names.map((name) => card(name)),
      [
        ...names.map((name, at): [string, string] => [
          name,
          names[(at + 1) % names.length]!,
        ]),
        ['A', 'D'],
        ['B', 'E'],
        ['C', 'F'],
      ],
    );
    const weigh = (placed: readonly PlacedElement[]) => {
      const { through, crossings } = tangleOf(graph, placed);
      return through * 10 + crossings * 6;
    };
    const placed = layoutByRelations(graph).elements;
    expect(weigh(placed)).toBeLessThanOrEqual(
      weigh(layoutExploration(graph).elements),
    );
    // Every card placed once, none on another.
    const at = [...onCanvas(placed).values()];
    expect(at).toHaveLength(6);
    for (const one of at)
      for (const other of at)
        if (one !== other)
          expect(
            one.x + one.width <= other.x ||
              other.x + other.width <= one.x ||
              one.y + one.height <= other.y ||
              other.y + other.height <= one.y,
          ).toBe(true);
  });

  it('reorders one frame alone, for the relations among what it holds', () => {
    const frame = card('Frame');
    const held = ['A', 'B', 'C'].map((name) => card(name, 'Frame'));
    const outside = card('Outside');
    // A reaches C through B inside the frame; a relation leaves it too.
    const graph = graphOf(
      [frame, ...held, outside],
      [
        ['A', 'C'],
        ['B', 'Outside'],
      ],
    );
    const inside = layoutByRelations(graph, 'Frame').elements;
    // What the frame holds, and nothing else, from the corner of its room.
    expect(inside.map(({ element }) => element.id).toSorted()).toEqual([
      'A',
      'B',
      'C',
    ]);
    expect(Math.min(...inside.map(({ x }) => x))).toBe(0);
    expect(Math.min(...inside.map(({ y }) => y))).toBe(0);
    // A and C next to each other now, B no longer between them.
    const at = new Map(inside.map((each) => [each.element.id, each]));
    const [a, c] = [at.get('A')!, at.get('C')!];
    expect(
      Math.max(Math.abs(a.x - c.x) - a.width, Math.abs(a.y - c.y) - a.height),
    ).toBe(SPACING);
  });

  it('gives what it has when its tries are up', () => {
    const graph = graphOf(
      [card('A'), card('B'), card('C'), card('D')],
      [
        ['A', 'D'],
        ['B', 'C'],
      ],
    );
    const placed = layoutByRelations(graph, null, {
      ms: 1000,
      tries: 0,
    }).elements;
    expect(placed.map(({ element }) => element.id).toSorted()).toEqual([
      'A',
      'B',
      'C',
      'D',
    ]);
  });
});
