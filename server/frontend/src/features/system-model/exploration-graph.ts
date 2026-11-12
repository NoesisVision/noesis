import { byIdOf } from '#/shared/collections.ts';
import { type ElementPicks, NO_PICKS } from './exploration-choice.ts';
import {
  DRAWN_RELATIONS,
  drawnIdOf,
  type DrawnRelationKind,
  type RelationKind,
} from './exploration-relations.ts';
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

export interface ExplorationGraph {
  elements: DrawnElement[];
  relations: DrawnRelation[];
}

/**
 * What is drawn: the elements of the groups shown, with those added one by
 * one and without those removed, each contained by the nearest container
 * still shown, and the relations asked for between them. A relation to a
 * hidden element is left out, not moved elsewhere.
 */
export function graphOf(
  exploration: Exploration,
  {
    hidden,
    relations,
    picks = NO_PICKS,
  }: {
    hidden: ReadonlySet<string>;
    relations: ReadonlySet<RelationKind>;
    picks?: ElementPicks;
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

  return {
    elements: shown.map((element) => ({
      ...element,
      parent: nested ? containerOf(element) : null,
    })),
    relations: drawn,
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
