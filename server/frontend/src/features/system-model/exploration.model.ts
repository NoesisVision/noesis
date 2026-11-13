import { recordOf } from '#/shared/collections.ts';
import { kindLabelOf } from '#/shared/model/element-words.ts';
import { modelWordOf } from '#/shared/ui/title-case.ts';
import type {
  BuildingBlockKind,
  Cardinality,
  SystemModel,
} from '#backend/app/system-model/system-model.ts';
import {
  CONTAINMENT,
  DRAWN_KINDS,
  DRAWN_OF_MODEL,
  DRAWN_RELATIONS,
  drawnIdOf,
  type DrawnRelationKind,
  type Pair,
} from './exploration-relations.ts';

/*
 * The scanned model read as a graph of explored elements, and how an
 * element is grouped and named in words.
 */

export type ExploredKind =
  | 'module'
  | 'building_block'
  | 'behavior'
  | 'actor'
  | 'manual_process'
  | 'deployable_unit'
  | 'library'
  | 'layer'
  | 'deployment_container';

export interface ExploredElement {
  id: string;
  kind: ExploredKind;
  name: string;
  /** The building block's type; null for any other element. */
  pattern: BuildingBlockKind | null;
  /** The element that contains this one, if the model holds it. */
  container: string | null;
}

export interface Exploration {
  elements: ExploredElement[];
  /**
   * The pairs each drawn relation joins, each pair once; the calls in the
   * order of the calls, caller by caller.
   */
  edges: Record<DrawnRelationKind, Pair[]>;
  /**
   * How many each pair's slots hold — its state, inputs, output, what it
   * works with — by the drawn relation's id, in the order the model lists
   * them, each once. A pair joined by no slot has none. Read, not drawn:
   * the edges do not show it yet.
   */
  cardinalities: ReadonlyMap<string, readonly Cardinality[]>;
}

export function explorationOf(model: SystemModel): Exploration {
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
      pattern: null,
      container: container(behavior.id),
    })),
    ...model.actors.map((actor) => ({
      id: actor.id,
      kind: 'actor' as const,
      name: actor.name,
      pattern: null,
      container: null,
    })),
    ...model.manualProcesses.map((process) => ({
      id: process.id,
      kind: 'manual_process' as const,
      name: process.name,
      pattern: null,
      container: null,
    })),
    ...artifactsOf(model).map(({ kind, element }) => ({
      id: element.id,
      kind,
      name: element.name,
      pattern: null,
      container: null,
    })),
  ];

  // A slot typed by a primitive, or a relation of an element the model does
  // not list, joins nothing drawn; a relation to oneself is no edge either.
  const joinable = new Set<string>(
    [
      // A module is joined only by what ships it; containment is no edge.
      ...model.modules,
      ...model.buildingBlocks,
      ...model.behaviors,
      ...model.actors,
      ...model.manualProcesses,
      ...artifactsOf(model).map(({ element }) => element),
    ].map(({ id }) => id),
  );
  const known = (id: string) => joinable.has(id);
  const pairs = new Map<DrawnRelationKind, Map<string, Pair>>(
    DRAWN_RELATIONS.map(({ kind }) => [kind, new Map()]),
  );
  const calls: { from: string; to: string; order: number }[] = [];
  const cardinalities = new Map<string, Cardinality[]>();
  for (const relation of model.relations) {
    const { from, to } = relation;
    const kind = DRAWN_OF_MODEL.get(relation.kind);
    if (kind === undefined || from === to || !known(from) || !known(to))
      continue;
    if (
      relation.kind === 'behavior_invokes_behavior' ||
      relation.kind === 'process_invokes_behavior'
    )
      calls.push({ from, to, order: relation.order });
    else pairs.get(kind)?.set(`${from}->${to}`, [from, to]);
    if ('cardinality' in relation) {
      const id = drawnIdOf(kind, from, to);
      const found = cardinalities.get(id) ?? [];
      if (!found.includes(relation.cardinality))
        cardinalities.set(id, [...found, relation.cardinality]);
    }
  }
  const edges = recordOf(DRAWN_KINDS, (kind): Pair[] => [
    ...(pairs.get(kind)?.values() ?? []),
  ]);
  edges.invokes = calls
    .sort((a, b) => byCodeUnit(a.from, b.from) || a.order - b.order)
    .map(({ from, to }): Pair => [from, to]);
  return { elements, edges, cardinalities };
}

/** What the code is built into and runs on, and the layers it is cut in: elements in no module. */
const artifactsOf = (model: SystemModel) => [
  ...model.deployableUnits.map((element) => ({
    kind: 'deployable_unit' as const,
    element,
  })),
  ...model.libraries.map((element) => ({ kind: 'library' as const, element })),
  ...model.layers.map((element) => ({ kind: 'layer' as const, element })),
  ...model.deploymentContainers.map((element) => ({
    kind: 'deployment_container' as const,
    element,
  })),
];

/** Ids are ASCII, so code-unit order is alphabetical without a locale. */
const byCodeUnit = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);

/** What an element is filtered by: its type, or "module" for a module. */
export const groupOf = (element: ExploredElement): string =>
  element.pattern ?? element.kind;

export const groupLabelOf = (group: string): string => modelWordOf(group);

/** What an element is, in words: "Building Block · Value Object". */
export const kindWordOf = (element: ExploredElement): string =>
  element.pattern === null
    ? kindLabelOf(element.kind)
    : `${kindLabelOf(element.kind)} · ${groupLabelOf(element.pattern)}`;
