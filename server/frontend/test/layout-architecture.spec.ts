import { describe, expect, it } from 'bun:test';
import { architectureOf } from '../src/features/design-docs/design-doc-architecture';
import {
  adapterInId,
  adapterOutId,
  callerId,
  hexagonId,
  type LaidOutNode,
  layoutArchitecture,
} from '../src/features/design-docs/ui/layout-architecture';
import { qdocArchitectureFixture } from './fixtures/design-doc-architecture.fixture';

const outline = architectureOf(qdocArchitectureFixture);
const layout = layoutArchitecture(outline.hexagons);
const byId = new Map(layout.nodes.map((node) => [node.id, node]));
const node = (id: string): LaidOutNode => {
  const found = byId.get(id);
  if (found === undefined) throw new Error(`no node ${id}`);
  return found;
};
const contains = (outer: LaidOutNode, inner: LaidOutNode) =>
  inner.x >= outer.x &&
  inner.y >= outer.y &&
  inner.x + inner.width <= outer.x + outer.width &&
  inner.y + inner.height <= outer.y + outer.height;
const overlaps = (a: LaidOutNode, b: LaidOutNode) =>
  a.x < b.x + b.width &&
  b.x < a.x + a.width &&
  a.y < b.y + b.height &&
  b.y < a.y + a.height;

const PREPARATION = 'module|qdocmanagement.preparation';
const NOTIFICATIONS = 'module|qdocmanagement.notifications';
const CREATE =
  'behavior|qdocmanagement.preparation.QDocCreationService.createQDoc';
const NOTIFY =
  'behavior|qdocmanagement.notifications.NotificationService.notifyUsers';
const REPOSITORY = 'building_block|qdocmanagement.preparation.QDocRepository';

describe('layoutArchitecture', () => {
  it('is the same every time for the same design', () => {
    expect(layoutArchitecture(outline.hexagons)).toEqual(layout);
  });

  it('draws each hexagon in a column of its own, in the outline’s order', () => {
    expect(node(hexagonId(PREPARATION)).x).toBeLessThan(
      node(hexagonId(NOTIFICATIONS)).x,
    );
    expect(
      overlaps(node(hexagonId(PREPARATION)), node(hexagonId(NOTIFICATIONS))),
    ).toBe(false);
  });

  it('puts every ring inside its hexagon, and the actors and adapters outside it', () => {
    const hexagon = node(hexagonId(PREPARATION));
    for (const inside of [CREATE, REPOSITORY])
      expect(contains(hexagon, node(inside))).toBe(true);
    for (const outside of [
      adapterInId(CREATE),
      adapterOutId(REPOSITORY),
      `actor:${PREPARATION}:Quality manager`,
    ])
      expect(overlaps(hexagon, node(outside))).toBe(false);
  });

  it('stacks the bands top to bottom', () => {
    const top = (id: string) => node(id).y;
    expect(top(`actor:${PREPARATION}:Quality manager`)).toBeLessThan(
      top(adapterInId(CREATE)),
    );
    expect(top(adapterInId(CREATE))).toBeLessThan(top(CREATE));
    expect(top(CREATE)).toBeLessThan(
      top('building_block|qdocmanagement.preparation.QDocCreationService'),
    );
    expect(
      top('building_block|qdocmanagement.preparation.QDocCreationService'),
    ).toBeLessThan(top('building_block|qdocmanagement.preparation.QDoc'));
    expect(top('building_block|qdocmanagement.preparation.QDoc')).toBeLessThan(
      top(REPOSITORY),
    );
    expect(top(REPOSITORY)).toBeLessThan(top(adapterOutId(REPOSITORY)));
  });

  it('places the domain core in a hexagon of its own, with no card on another', () => {
    const cores = layout.nodes.filter(({ kind }) => kind === 'domainCore');
    const cards = layout.nodes.filter(
      ({ kind }) => kind !== 'hexagon' && kind !== 'domainCore',
    );
    for (const card of cards.filter(({ kind }) => kind === 'element'))
      expect(cores.some((core) => contains(core, card))).toBe(true);
    for (const [index, card] of cards.entries())
      for (const other of cards.slice(index + 1))
        expect(overlaps(card, other)).toBe(false);
  });

  it('draws an unknown caller for a port that names no actor', () => {
    expect(node(callerId(NOTIFY))).toMatchObject({
      kind: 'caller',
      label: 'Another subsystem',
    });
  });

  it('joins only what the document holds', () => {
    expect(
      layout.edges.map(({ source, target, kind }) => [source, target, kind]),
    ).toEqual(
      expect.arrayContaining([
        [`actor:${PREPARATION}:Quality manager`, adapterInId(CREATE), 'drives'],
        [adapterInId(CREATE), CREATE, 'adapts'],
        [
          CREATE,
          'building_block|qdocmanagement.preparation.QDocCreationService',
          'owns',
        ],
        [REPOSITORY, adapterOutId(REPOSITORY), 'implements'],
        [callerId(NOTIFY), adapterInId(NOTIFY), 'drives'],
      ]),
    );
    // Two ports, each with its driver, adapter and service; four driven ports.
    expect(layout.edges).toHaveLength(2 * 3 + 4);
  });

  it('chooses the module for a hexagon, and the card itself for the rest', () => {
    expect(node(hexagonId(PREPARATION)).selects).toBe(PREPARATION);
    expect(node(adapterInId(CREATE)).selects).toBe(adapterInId(CREATE));
  });

  it('draws nothing for a design with no hexagon', () => {
    expect(layoutArchitecture([])).toEqual({
      nodes: [],
      edges: [],
      width: 0,
      height: 0,
    });
  });
});
