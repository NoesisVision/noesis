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

/** A slot as a card carries it: drawn on the card, never as an edge. */
export interface Badge extends Slot {
  /** Its type is a card still on the diagram, kept there for its own sake. */
  onDiagram: boolean;
}

export interface ExplorationGraph {
  elements: DrawnElement[];
  relations: DrawnRelation[];
  /** Each drawn element's badges: the slots it holds, of the relations asked for. */
  badges: ReadonlyMap<string, readonly Badge[]>;
  /** What is on the diagram as badges only: shown, but no card. */
  folded: ReadonlySet<string>;
  /**
   * The behaviors drawn that give nothing back, their output asked for:
   * each says so where its signature would write its output's type.
   */
  noOutput: ReadonlySet<string>;
  /**
   * The cards whose container the model holds is not on the diagram: each
   * has a way to it beside its cross, and the room for that.
   */
  parentless: ReadonlySet<string>;
  /**
   * The cards with slots the reader hid on them: each has a way to show
   * them again beside its menu, and the room for that.
   */
  slotsHiddenOn?: ReadonlySet<string>;
}

/**
 * A card's slots shown or hidden together, card by card: its state, or
 * its input and output — its signature — as one.
 */
export type SlotGroup = 'state' | 'signature';

/** The cards whose slots of each group the reader hid. */
export type SlotsHidden = Readonly<Record<SlotGroup, ReadonlySet<string>>>;

export const NO_SLOTS_HIDDEN: SlotsHidden = {
  state: new Set(),
  signature: new Set(),
};

const slotGroupOf = (relation: SlotRelation): SlotGroup =>
  relation === 'state' ? 'state' : 'signature';

/** The relations that are slots, drawn on the cards that hold them. */
const SLOT_RELATIONS: ReadonlySet<DrawnRelationKind> = new Set<SlotRelation>([
  'state',
  'input',
  'output',
]);
const NONE_BY_SLOT: ReadonlySet<string> = new Set();

/**
 * What is drawn: the elements of the groups shown, with those added one by
 * one and without those removed, each contained by the nearest container
 * still shown, and the relations asked for between them. A relation to a
 * hidden element is left out, not moved elsewhere.
 *
 * The slot relations asked for are not edges but the badges of the cards
 * that hold them — but for those the reader hid on a card (`slotsHidden`),
 * which are no more drawn from it than a relation not asked for — and a
 * card that is on the diagram only as a slot's type leaves it: one the reader did not add by name — only by following a slot
 * from a card, or with its whole kind — joined by no other relation drawn,
 * with nothing drawn inside it. A type that stays is still not joined by
 * its slots' edges; its badges say it is there.
 */
export function graphOf(
  exploration: Exploration,
  {
    hidden,
    relations,
    picks = NO_PICKS,
    slotsHidden = NO_SLOTS_HIDDEN,
  }: {
    hidden: ReadonlySet<string>;
    relations: ReadonlySet<RelationKind>;
    picks?: ElementPicks;
    slotsHidden?: SlotsHidden;
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

  /** A slot of the card hid on it: drawn no more than one not asked for. */
  const hid = (kind: DrawnRelationKind, holder: string) =>
    SLOT_RELATIONS.has(kind) &&
    slotsHidden[slotGroupOf(kind as SlotRelation)].has(holder);
  const drawn: DrawnRelation[] = [];
  for (const { kind } of DRAWN_RELATIONS) {
    if (!relations.has(kind)) continue;
    for (const [source, target] of exploration.edges[kind])
      if (
        isShown.has(source) &&
        isShown.has(target) &&
        apart(source, target) &&
        !hid(kind, source)
      )
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
  // On the diagram for its own sake: added by name, joined by a relation
  // that is no slot, or drawn round something.
  const bySlot = picks.bySlot ?? NONE_BY_SLOT;
  const kept = new Set([...picks.added].filter((id) => !bySlot.has(id)));
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
  const noOutput = new Set<string>();
  for (const { id, kind } of onCards) {
    const held = exploration.slots.of.get(id) ?? [];
    const carried = held
      .filter(
        (slot) =>
          relations.has(slot.relation) &&
          !slotsHidden[slotGroupOf(slot.relation)].has(id),
      )
      .map((slot) => ({ ...slot, onDiagram: onDiagram.has(slot.type) }));
    if (carried.length > 0) badges.set(id, carried);
    if (saysNoOutput(kind, held, relations) && !slotsHidden.signature.has(id))
      noOutput.add(id);
  }
  return {
    elements: onCards,
    relations: drawn.filter(({ kind }) => !SLOT_RELATIONS.has(kind)),
    badges,
    folded,
    noOutput,
    slotsHiddenOn: new Set(
      onCards
        .filter(
          ({ id }) =>
            slotsHidden.state.has(id) || slotsHidden.signature.has(id),
        )
        .map(({ id }) => id),
    ),
    parentless: new Set(
      onCards
        .filter(
          ({ container }) => container !== null && !isShown.has(container),
        )
        .map(({ id }) => id),
    ),
  };
}

/** A behavior that gives nothing back, its output asked for: its signature says so. */
const saysNoOutput = (
  kind: ExploredElement['kind'],
  held: readonly Slot[],
  relations: ReadonlySet<RelationKind>,
) =>
  kind === 'behavior' &&
  relations.has('output') &&
  !held.some(({ relation }) => relation === 'output');

/**
 * The groups of slots each card would carry, of the relations asked for,
 * whether or not the reader hid them on it: what its menu offers to show
 * or hide.
 */
export function slotGroupsOf(
  exploration: Exploration,
  elements: readonly DrawnElement[],
  relations: ReadonlySet<RelationKind>,
): ReadonlyMap<string, readonly SlotGroup[]> {
  const groups = new Map<string, readonly SlotGroup[]>();
  for (const { id, kind } of elements) {
    const held = exploration.slots.of.get(id) ?? [];
    const has = (group: SlotGroup) =>
      held.some(
        (slot) =>
          slotGroupOf(slot.relation) === group && relations.has(slot.relation),
      ) ||
      (group === 'signature' && saysNoOutput(kind, held, relations));
    const carried = (['state', 'signature'] as const).filter(has);
    if (carried.length > 0) groups.set(id, carried);
  }
  return groups;
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
  // A slot drawn on a card joins the card to its type, when the type has a
  // card of its own too.
  for (const [holder, carried] of graph.badges)
    for (const { type, onDiagram } of carried) {
      if (type === id) elements.add(holder);
      if (holder === id && onDiagram) elements.add(type);
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

/** How much of something is drawn: all of it, none of it, or only part. */
export type HowMuchDrawn = boolean | 'mixed';

/**
 * How much of each element is drawn, counted with all the model holds
 * inside it, all the way down. Only part is the element without all inside
 * it, or some of what is inside without it; an element with nothing inside
 * is all drawn once it is.
 */
export function howMuchDrawn(
  exploration: Exploration,
  drawn: ReadonlySet<string>,
): ReadonlyMap<string, HowMuchDrawn> {
  const kids = new Map<string, string[]>();
  for (const { id, container } of exploration.elements)
    if (container !== null)
      kids.set(container, [...(kids.get(container) ?? []), id]);
  const much = new Map<string, HowMuchDrawn>();
  /** How many an element and all inside it are, and how many of them are drawn. */
  const count = (id: string): [all: number, drawn: number] => {
    let all = 1;
    let on = drawn.has(id) ? 1 : 0;
    for (const kid of kids.get(id) ?? []) {
      const [inside, insideOn] = count(kid);
      all += inside;
      on += insideOn;
    }
    much.set(id, on === 0 ? false : on === all ? true : 'mixed');
    return [all, on];
  };
  for (const { id, container } of exploration.elements)
    if (container === null) count(id);
  return much;
}
