import type { DesignDocId } from '#backend/app/design-docs/design-doc-id.ts';
import type { DesignDocument } from '#backend/app/design-docs/design-doc.ts';
import type {
  ScannedRule,
  ScannedScenario,
  SystemModel,
} from '#backend/app/system-model/system-model.ts';

/*
 * The scanned model read as the design documents are read: every element it
 * holds written out in full, so the model tree and the element panel show it
 * as they show a design. Nothing here is a change — the reader marks every
 * row unchanged — so the change sets only carry what the scan found.
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
      name: scenario.name,
      description: field(scenario.description),
      steps: field(scenario.steps),
    })),
  );
}

function rules(found: ScannedRule[]) {
  return added(
    found.map((rule) => ({
      name: rule.name,
      category: field(rule.category),
      ruleType: field(rule.ruleType),
      description: optional(rule.description),
      needs: field([]),
      rationale: UNSET,
      scenarios: scenarios(rule.scenarios),
    })),
  );
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
        rules: rules(module.rules),
      })),
    ),
    buildingBlocks: added(
      model.buildingBlocks.map((block) => ({
        id: block.id,
        name: field(block.name),
        type: field(block.type),
        definition: optional(block.description),
        diagram: UNSET,
        implements: { added: block.implements, removed: [] },
        properties: added(
          block.properties.map((property) => ({
            name: property.name,
            type: field(property.type),
            description: optional(property.description),
            optional: field(property.optional),
          })),
        ),
        rules: rules(block.rules),
        scenarios: scenarios(block.scenarios),
      })),
    ),
    behaviours: added(
      model.behaviours.map((behaviour) => ({
        id: behaviour.id,
        name: field(behaviour.name),
        type: field(behaviour.type),
        definition: optional(behaviour.description),
        diagram: UNSET,
        visibility: field(behaviour.visibility),
        input: added(
          behaviour.input.map((parameter) => ({
            name: parameter.name,
            type: field(parameter.type),
            description: optional(parameter.description),
            optional: field(parameter.optional),
          })),
        ),
        output: added(
          behaviour.output.map((result) => ({
            type: result.type,
            description: optional(result.description),
            optional: field(result.optional),
          })),
        ),
        rules: rules(behaviour.rules),
        scenarios: scenarios(behaviour.scenarios),
      })),
    ),
    implemented: true,
    implementedAt: model.scanned_at,
  };
}

/** Where the reader is in the model, as the address names it. */
export interface SystemModelSearch {
  node?: string;
  q?: string;
}

const word = (value: unknown) =>
  typeof value === 'string' && value !== '' ? value : undefined;

export const systemModelSearch = (
  search: Record<string, unknown>,
): SystemModelSearch => ({ node: word(search.node), q: word(search.q) });
