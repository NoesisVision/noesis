import { byIdOf } from '#/shared/collections.ts';
import { type ElementPicks, NO_PICKS } from './exploration-choice.ts';
import {
  DRAWN_RELATIONS,
  drawnIdOf,
  type DrawnRelationKind,
  type RelationKind,
} from './exploration-relations.ts';
import type { Slot, SlotRelation } from './exploration-slots.ts';
import {
  type Exploration,
  type ExploredElement,
  groupOf,
} from './exploration.model.ts';

/*
 * The graph drawn from what the reader chose: the elements shown, the
 * relations between them, and what relates to a selection.
 */

export interface DrawnElement extends ExploredElement {
  /** The shown element it is drawn inside, when containment is drawn. */
  parent: string | null;
}

export interface DrawnRelation {
  id: string;
  kind: DrawnRelationKind;
  source: string;
  target: string;
}

/** A slot as a card carries it, drawn on the card rather than as an edge. */
interface Badge extends Slot {
  /** Its type is a card still on the diagram, kept there for its own sake. */
  onDiagram: boolean;
}

/** Where slots are drawn: on the cards that hold them, or as edges to cards of their types. */
export type SlotDrawing = 'cards' | 'nodes';

export interface ExplorationGraph {
  elements: DrawnElement[];
  relations: DrawnRelation[];
  /** Each drawn element's badges, with slots on cards; none with slots as nodes. */
  badges: ReadonlyMap<string, readonly Badge[]>;
}

/** The relations that are slots, drawn on cards when slots are. */
const SLOT_RELATIONS: ReadonlySet<DrawnRelationKind> = new Set<SlotRelation>([
  'state',
  'input',
  'output',
]);
const NO_BADGES: ReadonlyMap<string, readonly Badge[]> = new Map();

/**
 * What is drawn: the elements of the groups shown, with those added one by
 * one and without those removed, each contained by the nearest container
 * still shown, and the relations asked for between them. A relation to a
 * hidden element is left out, not moved elsewhere.
 *
 * With slots on cards, the slot relations asked for are not edges but the
 * badges of the cards that hold them, and a card that is on the diagram
 * only as a slot's type leaves it: one the reader did not add, joined by no
 * other relation drawn, with nothing drawn inside it. A type that stays is
 * still not joined by its slots' edges; its badges say it is there.
 */
export function graphOf(
  exploration: Exploration,
  {
    hidden,
    relations,
    picks = NO_PICKS,
    slots = 'nodes',
  }: {
    hidden: ReadonlySet<string>;
    relations: ReadonlySet<RelationKind>;
    picks?: ElementPicks;
    slots?: SlotDrawing;
  },
): ExplorationGraph {
  const byId = byIdOf(exploration.elements);
  const shown = exploration.elements.filter(
    (element) =>
      picks.added.has(element.id) ||
      (!picks.removed.has(element.id) && !hidden.has(groupOf(element))),
  );
  const isShown = new Set(shown.map(({ id }) => id));
  const containerOf = (element: ExploredElement) => {
    let id = element.container;
    while (id !== null && !isShown.has(id))
      id = byId.get(id)?.container ?? null;
    return id;
  };
  // Containment, either way round, is drawn as cards inside their container.
  const nested = relations.has('contains') || relations.has('isPartOf');

  // Whether one is drawn inside the other, at any depth: an edge between
  // them would only run from a card to the border round it, and the
  // nesting already shows they belong together.
  const inside = (id: string, around: string): boolean => {
    for (let at = byId.get(id); at !== undefined;) {
      const holder = containerOf(at);
      if (holder === null) return false;
      if (holder === around) return true;
      at = byId.get(holder);
    }
    return false;
  };
  const apart = (one: string, other: string) =>
    !nested || (!inside(one, other) && !inside(other, one));

  const drawn: DrawnRelation[] = [];
  for (const { kind } of DRAWN_RELATIONS) {
    if (!relations.has(kind)) continue;
    for (const [source, target] of exploration.edges[kind])
      if (isShown.has(source) && isShown.has(target) && apart(source, target))
        drawn.push({
          id: drawnIdOf(kind, source, target),
          kind,
          source,
          target,
        });
  }

  const elements = shown.map((element) => ({
    ...element,
    parent: nested ? containerOf(element) : null,
  }));
  if (slots === 'nodes')
    return { elements, relations: drawn, badges: NO_BADGES };

  // On the diagram for its own sake: added by hand, joined by a relation
  // that is no slot, or drawn round something.
  const kept = new Set(picks.added);
  for (const relation of drawn)
    if (!SLOT_RELATIONS.has(relation.kind)) {
      kept.add(relation.source);
      kept.add(relation.target);
    }
  for (const element of elements)
    if (element.parent !== null) kept.add(element.parent);
  const folded = new Set(
    drawn
      .filter(
        ({ kind, target }) => SLOT_RELATIONS.has(kind) && !kept.has(target),
      )
      .map(({ target }) => target),
  );
  const onCards = elements.filter(({ id }) => !folded.has(id));
  const onDiagram = new Set(onCards.map(({ id }) => id));
  const badges = new Map<string, readonly Badge[]>();
  for (const { id } of onCards) {
    const carried = (exploration.slots.of.get(id) ?? [])
      .filter((slot) => relations.has(slot.relation))
      .map((slot) => ({ ...slot, onDiagram: onDiagram.has(slot.type) }));
    if (carried.length > 0) badges.set(id, carried);
  }
  return {
    elements: onCards,
    relations: drawn.filter(({ kind }) => !SLOT_RELATIONS.has(kind)),
    badges,
  };
}

/** The relations drawn from or to an element, and what they join it to. */
export function relatedTo(graph: ExplorationGraph, id: string | null) {
  const relations = new Set<string>();
  const elements = new Set<string>();
  if (id === null) return { relations, elements };
  for (const relation of graph.relations)
    if (relation.source === id || relation.target === id) {
      relations.add(relation.id);
      elements.add(relation.source === id ? relation.target : relation.source);
    }
  // Containment drawn as nesting joins what holds it and what it holds.
  for (const element of graph.elements) {
    if (element.parent === id) elements.add(element.id);
    if (element.id === id && element.parent !== null)
      elements.add(element.parent);
  }
  return { relations, elements };
}

/** What a relation drawn from or to any of these joins them to, together. */
export function relatedToAll(graph: ExplorationGraph, ids: readonly string[]) {
  const relations = new Set<string>();
  const elements = new Set<string>();
  for (const id of ids) {
    const one = relatedTo(graph, id);
    for (const relation of one.relations) relations.add(relation);
    for (const element of one.elements) elements.add(element);
  }
  return { relations, elements };
}

/**
 * What taking these off the diagram takes off with them: each, and all that
 * is drawn inside it. With containment not drawn, nothing is inside, so only
 * what was named goes.
 */
export function removalOf(
  graph: ExplorationGraph,
  ids: readonly string[],
): string[] {
  const gone = new Set<string>();
  const take = (id: string) => {
    if (gone.has(id)) return;
    gone.add(id);
    for (const element of graph.elements)
      if (element.parent === id) take(element.id);
  };
  for (const id of ids) take(id);
  return [...gone];
}
