import { z } from 'zod';

const NAME = String.raw`[^.|\s](?:[^.|]*[^.|\s])?`;

/** `{kind}|`, at least `minContainers` container names, then the element's own name. */
const idPattern = (kind: string, minContainers: number) =>
  new RegExp(`^${kind}\\|(?:${NAME}\\.){${minContainers},}${NAME}$`);

export const ElementName = z
  .string()
  .regex(new RegExp(`^${NAME}$`))
  .describe(
    "The name of a single element: never empty, never padded with whitespace, and never containing the separators '.' and '|'.",
  );
export type ElementName = z.infer<typeof ElementName>;

const MODULE_KIND = 'module';
const moduleIdSchema = z
  .string()
  .regex(idPattern(MODULE_KIND, 0), 'Invalid ModuleId')
  .describe(
    "A module's id: 'module|{L1Name}', 'module|{L1Name}.{L2Name}', … to any depth, because modules nest.",
  )
  .brand<'ModuleId'>();

export const ModuleId = Object.assign(moduleIdSchema, {
  root: (name: string) =>
    moduleIdSchema.parse(`${MODULE_KIND}|${ElementName.parse(name)}`),
  within: (parent: ModuleId, name: string) =>
    moduleIdSchema.parse(`${MODULE_KIND}|${childPath(parent, name)}`),
  containing: (id: BuildingBlockId | BehaviorId) => {
    const block = ElementId.isBehavior(id)
      ? BuildingBlockId.containing(id)
      : id;
    return moduleIdSchema.parse(`${MODULE_KIND}|${parentPathOf(block)}`);
  },
  parentOf: (id: ModuleId) => {
    const parentPath = parentPathOf(id);
    return parentPath === ''
      ? null
      : moduleIdSchema.parse(`${MODULE_KIND}|${parentPath}`);
  },
});

export type ModuleId = z.infer<typeof moduleIdSchema>;

const BUILDING_BLOCK_KIND = 'building_block';
const buildingBlockIdSchema = z
  .string()
  .regex(idPattern(BUILDING_BLOCK_KIND, 1), 'Invalid BuildingBlockId')
  .describe(
    "A building block's id: 'building_block|', then its module's path, then its name, e.g. 'building_block|sales.orders.Refund'.",
  )
  .brand<'BuildingBlockId'>();
export const BuildingBlockId = Object.assign(buildingBlockIdSchema, {
  within: (parent: ModuleId, name: string) =>
    buildingBlockIdSchema.parse(
      `${BUILDING_BLOCK_KIND}|${childPath(parent, name)}`,
    ),
  containing: (id: BehaviorId) =>
    buildingBlockIdSchema.parse(`${BUILDING_BLOCK_KIND}|${parentPathOf(id)}`),
});
export type BuildingBlockId = z.infer<typeof buildingBlockIdSchema>;

const BEHAVIOR_KIND = 'behavior';
const behaviorIdSchema = z
  .string()
  .regex(idPattern(BEHAVIOR_KIND, 2), 'Invalid BehaviorId')
  .describe(
    "A behavior's id: 'behavior|', then its building block's path, then its name, e.g. 'behavior|sales.orders.Refund.issue'.",
  )
  .brand<'BehaviorId'>();
export const BehaviorId = Object.assign(behaviorIdSchema, {
  within: (parent: BuildingBlockId, name: string) =>
    behaviorIdSchema.parse(`${BEHAVIOR_KIND}|${childPath(parent, name)}`),
});
export type BehaviorId = z.infer<typeof behaviorIdSchema>;

const RULE_KIND = 'rule';
const ruleIdSchema = z
  .string()
  .regex(idPattern(RULE_KIND, 1), 'Invalid RuleId')
  .describe(
    "A rule's id: 'rule|', then the path of the module of the behavior that governs it, then its name, e.g. 'rule|sales.orders.Non-empty order'.",
  )
  .brand<'RuleId'>();
export const RuleId = Object.assign(ruleIdSchema, {
  within: (module: ModuleId, name: string) =>
    ruleIdSchema.parse(`${RULE_KIND}|${childPath(module, name)}`),
});
export type RuleId = z.infer<typeof ruleIdSchema>;

const SCENARIO_KIND = 'scenario';
const scenarioIdSchema = z
  .string()
  .regex(idPattern(SCENARIO_KIND, 2), 'Invalid ScenarioId')
  .describe(
    "A scenario's id: 'scenario|', then its rule's path, then its name, e.g. 'scenario|sales.orders.Non-empty order.An order without lines is refused'.",
  )
  .brand<'ScenarioId'>();
export const ScenarioId = Object.assign(scenarioIdSchema, {
  within: (rule: RuleId, name: string) =>
    scenarioIdSchema.parse(`${SCENARIO_KIND}|${childPath(rule, name)}`),
});
export type ScenarioId = z.infer<typeof scenarioIdSchema>;

const elementIdSchema = z.union([
  moduleIdSchema,
  buildingBlockIdSchema,
  behaviorIdSchema,
  ruleIdSchema,
  scenarioIdSchema,
]);
export const ElementId = Object.assign(elementIdSchema, {
  nameOf: (id: ElementId): ElementName => pathOf(id).split('.').at(-1)!,
  isModule: (id: ElementId): id is ModuleId => id.startsWith(`${MODULE_KIND}|`),
  isBuildingBlock: (id: ElementId): id is BuildingBlockId =>
    id.startsWith(`${BUILDING_BLOCK_KIND}|`),
  isBehavior: (id: ElementId): id is BehaviorId =>
    id.startsWith(`${BEHAVIOR_KIND}|`),
  isRule: (id: ElementId): id is RuleId => id.startsWith(`${RULE_KIND}|`),
  isScenario: (id: ElementId): id is ScenarioId =>
    id.startsWith(`${SCENARIO_KIND}|`),
  match: <R>(id: ElementId, on: ElementIdHandlers<R>): R => {
    if (ElementId.isModule(id)) return on.module(id);
    if (ElementId.isBuildingBlock(id)) return on.buildingBlock(id);
    if (ElementId.isRule(id)) return on.rule(id);
    if (ElementId.isScenario(id)) return on.scenario(id);
    return on.behavior(id);
  },
});
export type ElementId = z.infer<typeof elementIdSchema>;

type ElementIdHandlers<R> = {
  module: (id: ModuleId) => R;
  buildingBlock: (id: BuildingBlockId) => R;
  behavior: (id: BehaviorId) => R;
  rule: (id: RuleId) => R;
  scenario: (id: ScenarioId) => R;
};

function pathOf(id: ElementId): string {
  return id.slice(id.indexOf('|') + 1);
}

/** `id`'s path without its own name; empty for a root module. */
function parentPathOf(id: ElementId): string {
  return pathOf(id).split('.').slice(0, -1).join('.');
}

function childPath(parent: ElementId, name: string): string {
  return `${pathOf(parent)}.${ElementName.parse(name)}`;
}
