import { titleCase } from '#/shared/ui/title-case.ts';
import type {
  BuildingBlockType,
  SystemModel,
} from '#backend/app/system-model/system-model.ts';

/*
 * The scanned model read as a graph: its modules, building blocks and
 * behaviors, and the relations the scan holds between them. A module
 * contains the modules and building blocks its id path names; a building
 * block contains its behaviors. A building block has as state the blocks
 * its state is typed with, and as collaborators the blocks it works with; a
 * behavior has as input the blocks it takes and
 * as output those it gives back; a block extends the blocks it extends or
 * implements. A behavior invokes the behaviors the scan found it calls, in
 * the order of the calls — where the scanner records calls; one that does
 * not leaves the model without any. A card reads containment from inside
 * too, as what it is part of; the filter names it once. An actor performs
 * manual processes, and a manual process invokes behaviors in order, as a
 * behavior does; neither is contained by anything.
 *
 * Deployment containers host deployable units, a unit contains modules, and
 * a library or a layer contains building blocks, so a block can be held by
 * its module, its layer and its library at once. A card is drawn inside one
 * frame only: a container outermost, a unit or a library inside it, and a
 * layer or a module inside the smallest of the others that holds every
 * block it holds — a layer may sit in a module or round modules, as its
 * blocks say. What holds an element it is not drawn inside is drawn as an
 * edge, under the same filter.
 */

type ExploredKind =
  | 'deployment_container'
  | 'deployable_unit'
  | 'library'
  | 'layer'
  | 'module'
  | 'building_block'
  | 'behavior'
  | 'actor'
  | 'manual_process';

export interface ExploredElement {
  id: string;
  kind: ExploredKind;
  name: string;
  /** The building block's type; null for any other element. */
  pattern: BuildingBlockType | null;
  /** The frame it is drawn inside, if the model holds one. */
  container: string | null;
}

/** A relation's two ends, as `[source, target]`. */
type Pair = [string, string];

/**
 * Each relation drawn as an edge, as the view knows it: the model's relation
 * it reads, how the filter names it, the word its edges carry, and its two
 * ways of reaching — from the source, and read back from the target.
 * Containment is drawn as cards inside cards, never as an edge.
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
    kind: 'collaborator',
    model: 'has_collaborator',
    label: 'Collaborators',
    word: 'has collaborator',
    reach: 'hasCollaborator',
    back: 'collaboratorOf',
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
    model: 'invokes',
    label: 'Invokes',
    word: 'invokes',
    reach: 'invokes',
    back: 'invokedBy',
  },
  {
    kind: 'performs',
    model: 'performs',
    label: 'Performs',
    word: 'performs',
    reach: 'performs',
    back: 'performedBy',
  },
] as const;

type DrawnRelationEntry = (typeof DRAWN_RELATIONS)[number];
export type DrawnRelationKind = DrawnRelationEntry['kind'];

/** How one element holds another: contains it, or — a container — hosts it. */
type HoldingKind = 'contains' | 'hosts';

interface Holding {
  kind: HoldingKind;
  from: string;
  to: string;
}

export interface Exploration {
  elements: ExploredElement[];
  /**
   * The pairs each drawn relation joins, each pair once; the calls in the
   * order of the calls, caller by caller.
   */
  edges: Record<DrawnRelationKind, Pair[]>;
  /** Every element that holds another, whether or not it is drawn round it. */
  holdings: Holding[];
}

export type RelationKind = 'contains' | DrawnRelationKind;

/** Every kind of edge the canvas draws: a drawn relation, or a holding not drawn as nesting. */
export type EdgeKind = DrawnRelationKind | HoldingKind;

/** Every relation the view names. */
export const RELATIONS: readonly { kind: RelationKind; label: string }[] = [
  { kind: 'contains', label: 'Contains' },
  ...DRAWN_RELATIONS.map(({ kind, label }) => ({ kind, label })),
];

/** The word an edge of each kind carries. */
export const RELATION_WORD = {
  ...(Object.fromEntries(
    DRAWN_RELATIONS.map(({ kind, word }) => [kind, word]),
  ) as Record<DrawnRelationKind, string>),
  contains: 'contains',
  hosts: 'hosts',
} as const satisfies Record<EdgeKind, string>;

const DRAWN_OF_MODEL = new Map<string, DrawnRelationKind>(
  DRAWN_RELATIONS.map(({ model, kind }) => [model, kind]),
);

const parentPath = (path: string) =>
  path.includes('.') ? path.slice(0, path.lastIndexOf('.')) : '';
const pathOf = (id: string) => id.slice(id.indexOf('|') + 1);

export function explorationOf(model: SystemModel): Exploration {
  const moduleIds = new Set<string>(model.modules.map(({ id }) => id));
  const blockIds = new Set<string>(model.buildingBlocks.map(({ id }) => id));
  const moduleOf = (id: string) => {
    const path = parentPath(pathOf(id));
    const module = `module|${path}`;
    return path !== '' && moduleIds.has(module) ? module : null;
  };
  const blockOf = (id: string) => {
    const block = `building_block|${parentPath(pathOf(id))}`;
    return blockIds.has(block) ? block : null;
  };
  const plain = { pattern: null, container: null };
  const elements: ExploredElement[] = [
    ...model.deploymentContainers.map((container) => ({
      ...plain,
      id: container.id,
      kind: 'deployment_container' as const,
      name: container.name,
    })),
    ...model.deployableUnits.map((unit) => ({
      ...plain,
      id: unit.id,
      kind: 'deployable_unit' as const,
      name: unit.name,
    })),
    ...model.libraries.map((library) => ({
      ...plain,
      id: library.id,
      kind: 'library' as const,
      name: library.name,
    })),
    ...model.layers.map((layer) => ({
      ...plain,
      id: layer.id,
      kind: 'layer' as const,
      name: layer.name,
    })),
    ...model.modules.map((module) => ({
      ...plain,
      id: module.id,
      kind: 'module' as const,
      name: module.name,
    })),
    ...model.buildingBlocks.map((block) => ({
      ...plain,
      id: block.id,
      kind: 'building_block' as const,
      name: block.name,
      pattern: block.type,
    })),
    ...model.behaviors.map((behavior) => ({
      ...plain,
      id: behavior.id,
      kind: 'behavior' as const,
      name: behavior.name,
    })),
    ...model.actors.map((actor) => ({
      ...plain,
      id: actor.id,
      kind: 'actor' as const,
      name: actor.name,
    })),
    ...model.manualProcesses.map((process) => ({
      ...plain,
      id: process.id,
      kind: 'manual_process' as const,
      name: process.name,
    })),
  ];

  // What holds what: a module what its id path names, a block its
  // behaviors, the rest as the model's relations say.
  const listed = new Set(elements.map(({ id }) => id));
  const holdings = new Map<string, Holding>();
  const hold = (kind: HoldingKind, from: string | null, to: string) => {
    if (from !== null && from !== to && listed.has(from) && listed.has(to))
      holdings.set(`${from}->${to}`, { kind, from, to });
  };
  for (const { id } of [...model.modules, ...model.buildingBlocks])
    hold('contains', moduleOf(id), id);
  for (const { id } of model.behaviors) hold('contains', blockOf(id), id);
  for (const relation of model.relations)
    if (relation.kind === 'contains' || relation.kind === 'hosts')
      hold(relation.kind, relation.from, relation.to);

  const frames = framesOf(elements, [...holdings.values()]);
  for (const element of elements)
    element.container =
      element.kind === 'behavior'
        ? blockOf(element.id)
        : (frames.get(element.id) ?? null);

  // A slot typed by a primitive, or a relation of an element the model does
  // not list, joins nothing drawn; a relation to oneself is no edge either.
  const joinable = new Set<string>(
    [
      ...model.buildingBlocks,
      ...model.behaviors,
      ...model.actors,
      ...model.manualProcesses,
    ].map(({ id }) => id),
  );
  const known = (id: string) => joinable.has(id);
  const pairs = new Map<DrawnRelationKind, Map<string, Pair>>(
    DRAWN_RELATIONS.map(({ kind }) => [kind, new Map()]),
  );
  const calls: { from: string; to: string; order: number }[] = [];
  for (const relation of model.relations) {
    const { from, to } = relation;
    const kind = DRAWN_OF_MODEL.get(relation.kind);
    if (kind === undefined || from === to || !known(from) || !known(to))
      continue;
    if (relation.kind === 'invokes')
      calls.push({ from, to, order: relation.order });
    else pairs.get(kind)?.set(`${from}->${to}`, [from, to]);
  }
  const edges = Object.fromEntries(
    [...pairs].map(([kind, found]) => [kind, [...found.values()]]),
  ) as Record<DrawnRelationKind, Pair[]>;
  edges.invokes = calls
    .sort((a, b) => a.from.localeCompare(b.from) || a.order - b.order)
    .map(({ from, to }): Pair => [from, to]);
  return { elements, edges, holdings: [...holdings.values()] };
}

/** How far out a kind of frame is drawn: a container outermost, then a unit or a library, then a layer or a module. */
const TIER: Partial<Record<ExploredKind, number>> = {
  deployment_container: 0,
  deployable_unit: 1,
  library: 1,
  layer: 2,
  module: 2,
};

/**
 * The frame each element is drawn inside: of the frames further out than it
 * that hold it — every block it holds, or, holding none, the element itself
 * — the innermost. A container or a unit is held only by what holds it in
 * the model. Of a layer and a module, the one holding more blocks is
 * further out; holding the same, the layer, and of two modules the one
 * whose path holds the other's.
 */
function framesOf(
  elements: readonly ExploredElement[],
  holdings: readonly Holding[],
): ReadonlyMap<string, string> {
  const byId = new Map(elements.map((each) => [each.id, each]));
  const held = new Map<string, string[]>();
  for (const { from, to } of holdings)
    held.set(from, [...(held.get(from) ?? []), to]);
  const direct = new Set(holdings.map(({ from, to }) => `${from}->${to}`));
  const blocks = new Map<string, ReadonlySet<string>>();
  const blocksOf = (id: string): ReadonlySet<string> => {
    const known = blocks.get(id);
    if (known !== undefined) return known;
    const found = new Set<string>();
    blocks.set(id, found);
    if (byId.get(id)?.kind === 'building_block') found.add(id);
    else
      for (const kid of held.get(id) ?? [])
        for (const block of blocksOf(kid)) found.add(block);
    return found;
  };

  const tierOf = (each: ExploredElement) => TIER[each.kind] ?? 3;
  // Further out first: by tier, then by the blocks held, then a layer over a
  // module, a shorter path over a longer, and by id.
  const rank = (each: ExploredElement) =>
    [
      tierOf(each),
      -blocksOf(each.id).size,
      each.kind === 'layer' ? 0 : 1,
      pathOf(each.id).split('.').length,
    ] as const;
  const outside = (one: ExploredElement, other: ExploredElement) => {
    const a = rank(one);
    const b = rank(other);
    for (let at = 0; at < a.length; at++)
      if (a[at] !== b[at]) return (a[at] ?? 0) < (b[at] ?? 0);
    return one.id < other.id;
  };

  const frames = elements.filter(({ kind }) => TIER[kind] !== undefined);
  const found = new Map<string, string>();
  for (const element of elements) {
    if (element.kind === 'behavior') continue;
    const own = blocksOf(element.id);
    const byModel = tierOf(element) < 2 || own.size === 0;
    const holds = (frame: string) => {
      if (byModel) return direct.has(`${frame}->${element.id}`);
      const theirs = blocksOf(frame);
      return [...own].every((block) => theirs.has(block));
    };
    let innermost: ExploredElement | null = null;
    for (const frame of frames)
      if (
        frame.id !== element.id &&
        outside(frame, element) &&
        holds(frame.id) &&
        (innermost === null || outside(innermost, frame))
      )
        innermost = frame;
    if (innermost !== null) found.set(element.id, innermost.id);
  }
  return found;
}

/** What an element is filtered by: its type, or "module" for a module. */
export const groupOf = (element: ExploredElement): string =>
  element.pattern ?? element.kind;

export const groupLabelOf = (group: string): string =>
  titleCase(group.replaceAll('_', ' '));

export interface ElementSection {
  title:
    | 'Deployment containers'
    | 'Deployable units'
    | 'Libraries'
    | 'Layers'
    | 'Modules'
    | 'Building blocks'
    | 'Behaviors'
    | 'Actors'
    | 'Manual processes';
  groups: { group: string; count: number }[];
}

const SECTIONS = [
  ['Deployment containers', 'deployment_container'],
  ['Deployable units', 'deployable_unit'],
  ['Libraries', 'library'],
  ['Layers', 'layer'],
  ['Modules', 'module'],
  ['Building blocks', 'building_block'],
  ['Behaviors', 'behavior'],
  ['Actors', 'actor'],
  ['Manual processes', 'manual_process'],
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
  for (const { from, to } of exploration.holdings) {
    map.get(from)?.contains.push(to);
    map.get(to)?.isPartOf.push(from);
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
  kind: EdgeKind;
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
  // Containment is drawn as cards inside their container.
  const nested = relations.has('contains');

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
  // What holds a shown element it is not drawn round: a layer or a library
  // whose blocks' modules lie partly outside it, a unit a module of which a
  // layer outside the unit draws round, a unit's second container.
  if (nested)
    for (const { kind, from, to } of exploration.holdings)
      if (isShown.has(from) && isShown.has(to) && !inside(to, from))
        drawn.push({
          id: `${kind}:${from}->${to}`,
          kind,
          source: from,
          target: to,
        });
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
  deployment_container: 'Deployment container',
  deployable_unit: 'Deployable unit',
  library: 'Library',
  layer: 'Layer',
  module: 'Module',
  building_block: 'Building block',
  behavior: 'Behavior',
  actor: 'Actor',
  manual_process: 'Manual process',
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
 * Behaviors and manual processes invoke, so a building block's or any
 * frame's calls are its behaviors', and a behavior stops the chain when the block it is on is
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
    (reach === 'invokes' || reach === 'invokedBy') &&
    (start.kind === 'building_block' || TIER[start.kind] !== undefined);
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
    frontier = [...new Set(inside(id))].filter(
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
