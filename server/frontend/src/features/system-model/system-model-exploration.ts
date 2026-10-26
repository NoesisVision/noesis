import { titleCase } from '#/shared/ui/title-case.ts';
import type {
  BehaviorType,
  BuildingBlockRef,
  BuildingBlockType,
  SystemModel,
} from '#backend/app/system-model/system-model.ts';

/*
 * The scanned model read as a graph: its modules, building blocks and
 * behaviors, and only the relations the scan holds. A module contains the
 * modules and building blocks its id path names; a building block contains
 * its behaviors. A building block uses the blocks its properties are typed
 * with, a behavior the blocks it takes and gives back. "Is part of" is
 * containment read from the inside. A behavior invokes the behaviors the
 * scan found it calls — where the scanner records calls; one that does not
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

export interface Exploration {
  elements: ExploredElement[];
  /** Which block uses which, as `[source, target]`, each pair once. */
  uses: [string, string][];
  /** Which behavior calls which, as `[caller, called]`, each pair once. */
  invokes: [string, string][];
}

export type RelationKind = 'contains' | 'isPartOf' | 'uses' | 'invokes';

/** Every relation the view names. */
export const RELATIONS: readonly { kind: RelationKind; label: string }[] = [
  { kind: 'contains', label: 'Contains' },
  { kind: 'isPartOf', label: 'Is part of' },
  { kind: 'uses', label: 'Uses' },
  { kind: 'invokes', label: 'Invokes' },
];

/**
 * The word an edge of each drawn relation carries. Containment is drawn as
 * cards inside cards, never as an edge, so only use and calls are.
 */
export const RELATION_WORD = {
  uses: 'uses',
  invokes: 'invokes',
} as const satisfies Partial<Record<RelationKind, string>>;

export type DrawnRelationKind = keyof typeof RELATION_WORD;

const parentPath = (path: string) =>
  path.includes('.') ? path.slice(0, path.lastIndexOf('.')) : '';
const pathOf = (id: string) => id.slice(id.indexOf('|') + 1);

/** The building blocks a type names, through any collection of them. */
function blocksOf(ref: BuildingBlockRef): string[] {
  if (typeof ref === 'object') return blocksOf(ref.collectionOf);
  return ref.startsWith('building_block|') ? [ref] : [];
}

export function explorationOf(model: SystemModel): Exploration {
  const moduleIds = new Set<string>(model.modules.map(({ id }) => id));
  const blockIds = new Set<string>(model.buildingBlocks.map(({ id }) => id));
  const moduleOf = (id: string) => {
    const path = parentPath(pathOf(id));
    const module = `module|${path}`;
    return path !== '' && moduleIds.has(module) ? module : null;
  };
  const elements: ExploredElement[] = [
    ...model.modules.map((module) => ({
      id: module.id,
      kind: 'module' as const,
      name: module.name,
      pattern: null,
      container: moduleOf(module.id),
    })),
    ...model.buildingBlocks.map((block) => ({
      id: block.id,
      kind: 'building_block' as const,
      name: block.name,
      pattern: block.type,
      container: moduleOf(block.id),
    })),
    ...model.behaviors.map((behavior) => ({
      id: behavior.id,
      kind: 'behavior' as const,
      name: behavior.name,
      pattern: behavior.type,
      container: blockIds.has(behavior.buildingBlockId)
        ? behavior.buildingBlockId
        : null,
    })),
  ];

  const uses = new Map<string, [string, string]>();
  const use = (source: string, refs: BuildingBlockRef[]) => {
    for (const target of refs.flatMap(blocksOf))
      if (target !== source && blockIds.has(target))
        uses.set(`${source}->${target}`, [source, target]);
  };
  for (const block of model.buildingBlocks)
    use(
      block.id,
      block.properties.map(({ type }) => type),
    );
  for (const behavior of model.behaviors)
    use(behavior.id, [
      ...behavior.input.map(({ type }) => type),
      ...behavior.output.map(({ type }) => type),
    ]);
  const behaviorIds = new Set(model.behaviors.map(({ id }) => id));
  const invokes = new Map<string, [string, string]>();
  for (const behavior of model.behaviors)
    for (const called of behavior.invokes)
      if (called !== behavior.id && behaviorIds.has(called))
        invokes.set(`${behavior.id}->${called}`, [behavior.id, called]);
  return { elements, uses: [...uses.values()], invokes: [...invokes.values()] };
}

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
  | 'uses'
  | 'usedBy'
  | 'invokes'
  | 'invokedBy';

export const REACHES: readonly Reach[] = [
  'contains',
  'isPartOf',
  'uses',
  'usedBy',
  'invokes',
  'invokedBy',
];

/**
 * Whom an element is joined to, by how; "used by" is "uses" read from the
 * target, "invoked by" is "invokes" so.
 */
export type Neighbours = Record<Reach, string[]>;

/** Every element's neighbours, whatever is drawn. */
export function neighboursOf(
  exploration: Exploration,
): ReadonlyMap<string, Neighbours> {
  const map = new Map<string, Neighbours>(
    exploration.elements.map(({ id }) => [
      id,
      {
        contains: [],
        isPartOf: [],
        uses: [],
        usedBy: [],
        invokes: [],
        invokedBy: [],
      },
    ]),
  );
  for (const { id, container } of exploration.elements) {
    if (container === null) continue;
    map.get(container)?.contains.push(id);
    map.get(id)?.isPartOf.push(container);
  }
  for (const [source, target] of exploration.uses) {
    map.get(source)?.uses.push(target);
    map.get(target)?.usedBy.push(source);
  }
  for (const [caller, called] of exploration.invokes) {
    map.get(caller)?.invokes.push(called);
    map.get(called)?.invokedBy.push(caller);
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
  if (relations.has('uses'))
    for (const [source, target] of exploration.uses)
      if (isShown.has(source) && isShown.has(target) && apart(source, target))
        drawn.push({
          id: `uses:${source}->${target}`,
          kind: 'uses',
          source,
          target,
        });
  if (relations.has('invokes'))
    for (const [source, target] of exploration.invokes)
      if (isShown.has(source) && isShown.has(target) && apart(source, target))
        drawn.push({
          id: `invokes:${source}->${target}`,
          kind: 'invokes',
          source,
          target,
        });

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

/** The ways a chain can be followed: the relations drawn as edges, either way. */
export const CHAIN_REACHES = [
  'uses',
  'usedBy',
  'invokes',
  'invokedBy',
] as const satisfies readonly Reach[];

export type ChainReach = (typeof CHAIN_REACHES)[number];

/** How many steps a chain is followed at most, when the card's type is far off or never met. */
export const CHAIN_DEPTH = 5;

/** The relation a chain is drawn with. */
export const relationOfChain = (reach: ChainReach): DrawnRelationKind =>
  reach === 'uses' || reach === 'usedBy' ? 'uses' : 'invokes';

/**
 * Everything an element reaches one way, step after step, up to the next
 * element of its own type: that one is reached, but not followed further.
 * Only behaviours invoke, so a building block's or module's calls are its
 * behaviours', and a behaviour stops the chain when the block it is on is
 * of the type it started from. Those behaviours, and the blocks such a
 * chain ends on, are reached too, so the chain reads whole. It goes no
 * more than `depth` steps from the element, or from its behaviours.
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
    (reach === 'invokes' || reach === 'invokedBy') &&
    start.kind !== 'behaviour';
  const blockOf = (element: ExploredElement) =>
    element.kind === 'behaviour' && element.container !== null
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
        elements.get(each)?.kind === 'behaviour' &&
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
