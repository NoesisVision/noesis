import type { DesignDocId } from '#backend/app/design-docs/design-doc-id.ts';
import type {
  DesignDocument,
  DesignedRelation,
} from '#backend/app/design-docs/design-doc.ts';
import type {
  Relation,
  ScannedRule,
  ScannedScenario,
  SystemModel,
} from '#backend/app/system-model/system-model.ts';

/*
 * The scanned model read as the design documents are read: every element and
 * relation it holds written out in full, so the model tree and the element
 * panel show it as they show a design. Nothing here is a change — the reader
 * marks every row unchanged — so the change sets only carry what the scan
 * found.
 */

/** A value as a design document holds one. */
const field = <T>(value: T) =>
  ({ changed: true, value, author: 'agent' }) as const;

/** A field the scan has nothing for. */
const UNSET = { changed: false } as const;

const optional = <T>(value: T | null) =>
  value === null ? UNSET : field(value);

const added = <T>(items: T[]) => ({ added: items, removed: [], modified: [] });

function scenarios(found: ScannedScenario[]) {
  return added(
    found.map((scenario) => ({
      id: scenario.id,
      name: field(scenario.name),
      description: optional(scenario.description),
      steps: field(scenario.steps),
    })),
  );
}

function rules(found: ScannedRule[]) {
  return added(
    found.map((rule) => ({
      id: rule.id,
      name: field(rule.name),
      kind: field(rule.kind),
      description: optional(rule.description),
      needs: field([]),
      rationale: UNSET,
    })),
  );
}

/** A scanned relation as a design writes one: what the diagram puts on the edge becomes a field. */
function designedRelation(relation: Relation): DesignedRelation {
  switch (relation.kind) {
    case 'has_state':
      return {
        ...relation,
        to: field(relation.to),
        cardinality: field(relation.cardinality),
      };
    case 'has_collaborator':
      return {
        ...relation,
        to: field(relation.to),
        cardinality: field(relation.cardinality),
      };
    case 'has_input':
      return {
        ...relation,
        to: field(relation.to),
        cardinality: field(relation.cardinality),
        position: field(relation.position),
      };
    case 'has_output':
      return {
        ...relation,
        to: field(relation.to),
        cardinality: field(relation.cardinality),
      };
    case 'behavior_invokes_behavior':
    case 'process_invokes_behavior':
      return { ...relation, order: field(relation.order) };
    default:
      return relation;
  }
}

export function designOf(model: SystemModel): DesignDocument {
  return {
    // Not a document the graph holds: the id only keys what the reader keeps.
    id: `${model.scanned_at.slice(0, 10)}-${model.name}` as DesignDocId,
    name: model.name,
    description: '',
    needs: added([]),
    modules: added(
      model.modules.map((module) => ({
        id: module.id,
        name: field(module.name),
        definition: optional(module.description),
        diagram: UNSET,
      })),
    ),
    buildingBlocks: added(
      model.buildingBlocks.map((block) => ({
        id: block.id,
        name: field(block.name),
        type: field(block.type),
        definition: optional(block.description),
        diagram: UNSET,
      })),
    ),
    behaviors: added(
      model.behaviors.map((behavior) => ({
        id: behavior.id,
        name: field(behavior.name),
        definition: optional(behavior.description),
        diagram: UNSET,
      })),
    ),
    rules: rules(model.rules),
    scenarios: scenarios(model.scenarios),
    actors: added(
      model.actors.map((actor) => ({
        id: actor.id,
        name: field(actor.name),
        definition: optional(actor.description),
      })),
    ),
    manualProcesses: added(
      model.manualProcesses.map((process) => ({
        id: process.id,
        name: field(process.name),
        definition: optional(process.description),
      })),
    ),
    deployableUnits: added(
      model.deployableUnits.map((unit) => ({
        id: unit.id,
        name: field(unit.name),
        definition: optional(unit.description),
      })),
    ),
    libraries: added(
      model.libraries.map((library) => ({
        id: library.id,
        name: field(library.name),
        definition: optional(library.description),
      })),
    ),
    layers: added(
      model.layers.map((layer) => ({
        id: layer.id,
        name: field(layer.name),
        definition: optional(layer.description),
      })),
    ),
    deploymentContainers: added(
      model.deploymentContainers.map((container) => ({
        id: container.id,
        name: field(container.name),
        definition: optional(container.description),
      })),
    ),
    relations: added(model.relations.map(designedRelation)),
    implemented: true,
    implementedAt: model.scanned_at,
  };
}

/** The ways the scanned model is read: as the model tree, or explored as a diagram. */
export const SYSTEM_MODEL_VIEWS = ['model', 'exploration'] as const;
export type SystemModelViewName = (typeof SYSTEM_MODEL_VIEWS)[number];

export const isSystemModelView = (
  value: unknown,
): value is SystemModelViewName =>
  (SYSTEM_MODEL_VIEWS as readonly unknown[]).includes(value);

/** Where the reader is in the model, as the address names it; no view is the model. */
export interface SystemModelSearch {
  view?: 'exploration';
  node?: string;
  q?: string;
}

const word = (value: unknown) =>
  typeof value === 'string' && value !== '' ? value : undefined;

export const systemModelSearch = (
  search: Record<string, unknown>,
): SystemModelSearch => ({
  view: search.view === 'exploration' ? 'exploration' : undefined,
  node: word(search.node),
  q: word(search.q),
});
