import { titleCase } from '#/shared/ui/title-case.ts';
import type {
  BehaviorType,
  BuildingBlockType,
  Relation,
  SystemModel,
} from '#backend/app/system-model/system-model.ts';

/*
 * The scanned model read as a graph: its modules, building blocks and
 * behaviors, and its list of relations read as it is. A module contains the
 * modules and building blocks it holds ('module_contains_module',
 * 'module_contains_block'); a building block contains the behaviors it
 * exposes. A building block has as state the blocks its state is typed by
 * ('has_state'), a behavior has as input the blocks it takes ('has_input')
 * and as output the block it gives back ('has_output'); a block extends the
 * blocks it extends or implements. "Is part of" is containment read from the
 * inside. A behavior invokes the behaviors the scan found it calls, in the
 * order of the calls — where the scanner records calls; one that does not
 * leaves the model without any.
 */

type ExploredKind = 'module' | 'building_block' | 'behavior';

export interface ExploredElement {
  id: string;
  kind: ExploredKind;
  name: string;
  /** The building block's or behavior's type; null for a module. */
  pattern: BuildingBlockType | BehaviorType | null;
  /** The element that contains this one, if the model holds it. */
  container: string | null;
}

/** A relation's two ends, as `[source, target]`. */
type Pair = [string, string];

/**
 * Each relation drawn as an edge, as the view knows it: the model's relation
 * it reads, how the filter names it, the word its edges carry, and its two
 * ways of reaching — from the source, and read back from the target.
 * Containment is drawn as cards inside cards, never as an edge, and reads
 * `CONTAINMENT`.
 */
export const DRAWN_RELATIONS = [
  {
    kind: 'state',
    model: 'has_state',
    label: 'State',
    word: 'has state',
    reach: 'hasState',
    back: 'stateOf',
  },
  {
    kind: 'input',
    model: 'has_input',
    label: 'Input',
    word: 'has input',
    reach: 'hasInput',
    back: 'inputOf',
  },
  {
    kind: 'output',
    model: 'has_output',
    label: 'Output',
    word: 'has output',
    reach: 'hasOutput',
    back: 'outputOf',
  },
  {
    kind: 'extends',
    model: 'extends',
    label: 'Extends',
    word: 'extends',
    reach: 'extends',
    back: 'extendedBy',
  },
  {
    kind: 'invokes',
    model: 'behavior_invokes_behavior',
    label: 'Invokes',
    word: 'invokes',
    reach: 'invokes',
    back: 'invokedBy',
  },
] as const satisfies readonly {
  kind: string;
  model: Relation['kind'];
  label: string;
  word: string;
  reach: string;
  back: string;
}[];

/** The model's relations that place an element inside another: what "Contains" and "Is part of" read. */
const CONTAINMENT: ReadonlySet<string> = new Set([
  'module_contains_module',
  'module_contains_block',
  'exposes',
] satisfies Relation['kind'][]);

type DrawnRelationEntry = (typeof DRAWN_RELATIONS)[number];
export type DrawnRelationKind = DrawnRelationEntry['kind'];

export interface Exploration {
  elements: ExploredElement[];
  /**
   * The pairs each drawn relation joins, each pair once; the calls in the
   * order of the calls, caller by caller.
   */
  edges: Record<DrawnRelationKind, Pair[]>;
}

export type RelationKind = 'contains' | 'isPartOf' | DrawnRelationKind;

/** Every relation the view names. */
export const RELATIONS: readonly { kind: RelationKind; label: string }[] = [
  { kind: 'contains', label: 'Contains' },
  { kind: 'isPartOf', label: 'Is part of' },
  ...DRAWN_RELATIONS.map(({ kind, label }) => ({ kind, label })),
];

/** The word an edge of each drawn relation carries. */
export const RELATION_WORD = Object.fromEntries(
  DRAWN_RELATIONS.map(({ kind, word }) => [kind, word]),
) as Record<DrawnRelationKind, string>;

const DRAWN_OF_MODEL = new Map<string, DrawnRelationKind>(
  DRAWN_RELATIONS.map(({ model, kind }) => [model, kind]),
);

export function explorationOf(model: SystemModel): Exploration {
  const blockIds = new Set<string>(model.buildingBlocks.map(({ id }) => id));
  const behaviorIds = new Set<string>(model.behaviors.map(({ id }) => id));
  // What contains each element, as the containment relations say.
  const containerOf = new Map<string, string>();
  for (const relation of model.relations)
    if (CONTAINMENT.has(relation.kind))
      containerOf.set(relation.to, relation.from);
  const container = (id: string) => containerOf.get(id) ?? null;
  const elements: ExploredElement[] = [
    ...model.modules.map((module) => ({
      id: module.id,
      kind: 'module' as const,
      name: module.name,
      pattern: null,
      container: container(module.id),
    })),
    ...model.buildingBlocks.map((block) => ({
      id: block.id,
      kind: 'building_block' as const,
      name: block.name,
      pattern: block.type,
      container: container(block.id),
    })),
    ...model.behaviors.map((behavior) => ({
      id: behavior.id,
      kind: 'behavior' as const,
      name: behavior.name,
      pattern: behavior.type,
      container: container(behavior.id),
    })),
  ];

  // A slot typed by a primitive, or a relation of an element the model does
  // not list, joins nothing drawn; a relation to oneself is no edge either.
  const known = (id: string) => blockIds.has(id) || behaviorIds.has(id);
  const pairs = new Map<DrawnRelationKind, Map<string, Pair>>(
    DRAWN_RELATIONS.map(({ kind }) => [kind, new Map()]),
  );
  const calls: { from: string; to: string; order: number }[] = [];
  for (const relation of model.relations) {
    const { from, to } = relation;
    const kind = DRAWN_OF_MODEL.get(relation.kind);
    if (kind === undefined || from === to || !known(from) || !known(to))
      continue;
    if (relation.kind === 'behavior_invokes_behavior')
      calls.push({ from, to, order: relation.order });
    else pairs.get(kind)?.set(`${from}->${to}`, [from, to]);
  }
  const edges = Object.fromEntries(
    [...pairs].map(([kind, found]) => [kind, [...found.values()]]),
  ) as Record<DrawnRelationKind, Pair[]>;
  edges.invokes = calls
    .sort((a, b) => byCodeUnit(a.from, b.from) || a.order - b.order)
    .map(({ from, to }): Pair => [from, to]);
  return { elements, edges };
}

/** Ids are ASCII, so code-unit order is alphabetical without a locale. */
const byCodeUnit = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);

/** What an element is filtered by: its type, or "module" for a module. */
export const groupOf = (element: ExploredElement): string =>
  element.pattern ?? element.kind;

export const groupLabelOf = (group: string): string =>
  titleCase(group.replaceAll('_', ' '));

export interface ElementSection {
  title: 'Modules' | 'Building blocks' | 'Behaviors';
  groups: { group: string; count: number }[];
}

const SECTIONS = [
  ['Modules', 'module'],
  ['Building blocks', 'building_block'],
  ['Behaviors', 'behavior'],
] as const satisfies readonly [ElementSection['title'], ExploredKind][];

/** The groups a reader may hide, by kind of element, as many as the model holds. */
export function elementSectionsOf(exploration: Exploration): ElementSection[] {
  return SECTIONS.map(([title, kind]) => {
    const counts = new Map<string, number>();
    for (const element of exploration.elements)
      if (element.kind === kind)
        counts.set(groupOf(element), (counts.get(groupOf(element)) ?? 0) + 1);
    return {
      title,
      groups: [...counts].map(([group, count]) => ({ group, count })),
    };
  }).filter(({ groups }) => groups.length > 0);
}

/** The ways one element reaches others, each read from its own side. */
export type Reach =
  | 'contains'
  | 'isPartOf'
  | DrawnRelationEntry['reach']
  | DrawnRelationEntry['back'];

export const REACHES: readonly Reach[] = [
  'contains',
  'isPartOf',
  ...DRAWN_RELATIONS.flatMap(({ reach, back }) => [reach, back]),
];

/**
 * Whom an element is joined to, by how; "state of" is "has state" read from
 * the target, "extended by" is "extends" so, "invoked by" is "invokes" so.
 */
export type Neighbours = Record<Reach, string[]>;

/** Every element's neighbours, whatever is drawn. */
export function neighboursOf(
  exploration: Exploration,
): ReadonlyMap<string, Neighbours> {
  const map = new Map<string, Neighbours>(
    exploration.elements.map(({ id }) => [
      id,
      Object.fromEntries(
        REACHES.map((reach): [Reach, string[]] => [reach, []]),
      ) as Neighbours,
    ]),
  );
  for (const { id, container } of exploration.elements) {
    if (container === null) continue;
    map.get(container)?.contains.push(id);
    map.get(id)?.isPartOf.push(container);
  }
  for (const { kind, reach, back } of DRAWN_RELATIONS)
    for (const [source, target] of exploration.edges[kind]) {
      map.get(source)?.[reach].push(target);
      map.get(target)?.[back].push(source);
    }
  return map;
}

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

/** Elements the reader put in or took out one by one, over the groups shown. */
export interface ElementPicks {
  added: ReadonlySet<string>;
  removed: ReadonlySet<string>;
}

export const NO_PICKS: ElementPicks = { added: new Set(), removed: new Set() };

/** The picks with one element put in or taken out; the latest word on it wins. */
export function picked(
  picks: ElementPicks,
  id: string,
  shown: boolean,
): ElementPicks {
  const added = new Set(picks.added);
  const removed = new Set(picks.removed);
  if (shown) {
    added.add(id);
    removed.delete(id);
  } else {
    removed.add(id);
    added.delete(id);
  }
  return { added, removed };
}

/**
 * What the reader chose to draw: the groups shown — none until they pick
 * some — and the elements put in or taken out one by one over them.
 */
export interface ElementChoice {
  shown: ReadonlySet<string>;
  picks: ElementPicks;
}

export const NOTHING_CHOSEN: ElementChoice = {
  shown: new Set(),
  picks: NO_PICKS,
};

/**
 * The choice kept to what the exploration holds: a group or an element a
 * later scan no longer finds is forgotten, not kept for when it comes back.
 */
export function choiceWithin(
  choice: ElementChoice,
  exploration: Exploration,
): ElementChoice {
  const ids = new Set(exploration.elements.map(({ id }) => id));
  const groups = new Set(exploration.elements.map(groupOf));
  const kept = (names: ReadonlySet<string>, holds: Set<string>) =>
    new Set([...names].filter((name) => holds.has(name)));
  return {
    shown: kept(choice.shown, groups),
    picks: {
      added: kept(choice.picks.added, ids),
      removed: kept(choice.picks.removed, ids),
    },
  };
}

/** The groups a choice hides: every group of the exploration it does not show. */
export function hiddenBy(
  choice: ElementChoice,
  exploration: Exploration,
): ReadonlySet<string> {
  return new Set(
    exploration.elements
      .map(groupOf)
      .filter((group) => !choice.shown.has(group)),
  );
}

/** The picks with several elements put in or taken out at once. */
export const pickedAll = (
  picks: ElementPicks,
  ids: readonly string[],
  shown: boolean,
): ElementPicks => ids.reduce((each, id) => picked(each, id, shown), picks);

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
  const byId = new Map(exploration.elements.map((each) => [each.id, each]));
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
          id: `${kind}:${source}->${target}`,
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

/** An element's id without its kind, as the model's tooltips address it. */
export const addressOf = (id: string): string => id.slice(id.indexOf('|') + 1);

const KIND_WORD = {
  module: 'Module',
  building_block: 'Building block',
  behavior: 'Behavior',
} as const satisfies Record<ExploredKind, string>;

/** What an element is, in words: "Building block · Value Object". */
export const kindWordOf = (element: ExploredElement): string =>
  element.pattern === null
    ? KIND_WORD[element.kind]
    : `${KIND_WORD[element.kind]} · ${groupLabelOf(element.pattern)}`;

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

export type ChainReach = Exclude<Reach, 'contains' | 'isPartOf'>;

/** The ways a chain can be followed: the relations drawn as edges, either way. */
export const CHAIN_REACHES: readonly ChainReach[] = DRAWN_RELATIONS.flatMap(
  ({ reach, back }) => [reach, back],
);

/** How many steps a chain is followed at most, when the card's type is far off or never met. */
export const CHAIN_DEPTH = 5;

const RELATION_OF_REACH = new Map<ChainReach, DrawnRelationKind>(
  DRAWN_RELATIONS.flatMap(({ kind, reach, back }) => [
    [reach, kind],
    [back, kind],
  ]),
);

/** The relation a chain is drawn with. */
export const relationOfChain = (reach: ChainReach): DrawnRelationKind =>
  RELATION_OF_REACH.get(reach) ?? 'invokes';

/**
 * Everything an element reaches one way, step after step, up to the next
 * element of its own type: that one is reached, but not followed further.
 * Only behaviors invoke, so a building block's or module's calls are its
 * behaviors', and a behavior stops the chain when the block it is on is
 * of the type it started from. Those behaviors, and the blocks such a
 * chain ends on, are reached too, so the chain reads whole. It goes no
 * more than `depth` steps from the element, or from its behaviors.
 */
export function chainOf(
  neighbours: ReadonlyMap<string, Neighbours>,
  elements: ReadonlyMap<string, ExploredElement>,
  id: string,
  reach: ChainReach,
  depth: number = CHAIN_DEPTH,
): string[] {
  const start = elements.get(id);
  if (start === undefined) return [];
  const type = groupOf(start);
  const throughBehaviours =
    (reach === 'invokes' || reach === 'invokedBy') && start.kind !== 'behavior';
  const blockOf = (element: ExploredElement) =>
    element.kind === 'behavior' && element.container !== null
      ? elements.get(element.container)
      : undefined;
  const ends = (element: ExploredElement) => {
    if (groupOf(element) === type) return true;
    const block = throughBehaviours ? blockOf(element) : undefined;
    return block !== undefined && block.id !== id && groupOf(block) === type;
  };

  const reached = new Set<string>([id]);
  const order: string[] = [];
  const reachOf = (each: string) => {
    reached.add(each);
    order.push(each);
  };
  let frontier = [id];
  if (throughBehaviours) {
    // What is inside it, all the way down, that calls or is called.
    const inside = (holder: string): string[] =>
      (neighbours.get(holder)?.contains ?? []).flatMap((kid) => [
        kid,
        ...inside(kid),
      ]);
    frontier = inside(id).filter(
      (each) =>
        elements.get(each)?.kind === 'behavior' &&
        (neighbours.get(each)?.[reach].length ?? 0) > 0,
    );
    for (const each of frontier) reachOf(each);
  }
  for (let step = 0; step < depth && frontier.length > 0; step++) {
    const next: string[] = [];
    for (const from of frontier)
      for (const to of neighbours.get(from)?.[reach] ?? []) {
        const element = elements.get(to);
        if (reached.has(to) || element === undefined) continue;
        reachOf(to);
        if (!ends(element)) {
          next.push(to);
          continue;
        }
        const block = throughBehaviours ? blockOf(element) : undefined;
        if (block !== undefined && !reached.has(block.id)) reachOf(block.id);
      }
    frontier = next;
  }
  return order;
}
