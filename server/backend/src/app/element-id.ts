import { z } from 'zod';

const NAME = String.raw`[^.|\s](?:[^.|]*[^.|\s])?`;

/** `{kind}|`, at least `minContainers` container names, then the element's own name. */
const idPattern = (kind: string, minContainers: number) =>
  new RegExp(`^${kind}\\|(?:${NAME}\\.){${minContainers},}${NAME}$`);

/** `{kind}|`, then the element's own name: an element in no container. */
const topLevelIdPattern = (kind: string) => new RegExp(`^${kind}\\|${NAME}$`);

export const ElementName = z
  .string()
  .regex(new RegExp(`^${NAME}$`))
  .describe(
    "The name of a single element: never empty, never padded with whitespace, and never containing the separators '.' and '|'.",
  );
export type ElementName = z.infer<typeof ElementName>;

/** The kinds of element an id names, the part before `|`. */
export const ElementKind = z.enum([
  'module',
  'building_block',
  'behavior',
  'rule',
  'scenario',
  'actor',
  'manual_process',
]);
export type ElementKind = z.infer<typeof ElementKind>;

const MODULE_KIND = ElementKind.enum.module;
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

const BUILDING_BLOCK_KIND = ElementKind.enum.building_block;
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

const BEHAVIOR_KIND = ElementKind.enum.behavior;
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

const RULE_KIND = ElementKind.enum.rule;
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

const SCENARIO_KIND = ElementKind.enum.scenario;
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

const ACTOR_KIND = ElementKind.enum.actor;
const actorIdSchema = z
  .string()
  .regex(topLevelIdPattern(ACTOR_KIND), 'Invalid ActorId')
  .describe(
    "An actor's id: 'actor|', then its name, e.g. 'actor|Support agent'; actors belong to no module.",
  )
  .brand<'ActorId'>();
export const ActorId = Object.assign(actorIdSchema, {
  of: (name: string) =>
    actorIdSchema.parse(`${ACTOR_KIND}|${ElementName.parse(name)}`),
});
export type ActorId = z.infer<typeof actorIdSchema>;

const MANUAL_PROCESS_KIND = ElementKind.enum.manual_process;
const manualProcessIdSchema = z
  .string()
  .regex(topLevelIdPattern(MANUAL_PROCESS_KIND), 'Invalid ManualProcessId')
  .describe(
    "A manual process's id: 'manual_process|', then its name, e.g. 'manual_process|Refund a returned order'; manual processes belong to no module.",
  )
  .brand<'ManualProcessId'>();
export const ManualProcessId = Object.assign(manualProcessIdSchema, {
  of: (name: string) =>
    manualProcessIdSchema.parse(
      `${MANUAL_PROCESS_KIND}|${ElementName.parse(name)}`,
    ),
});
export type ManualProcessId = z.infer<typeof manualProcessIdSchema>;

const elementIdSchema = z.union([
  moduleIdSchema,
  buildingBlockIdSchema,
  behaviorIdSchema,
  ruleIdSchema,
  scenarioIdSchema,
  actorIdSchema,
  manualProcessIdSchema,
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
  isActor: (id: ElementId): id is ActorId => id.startsWith(`${ACTOR_KIND}|`),
  isManualProcess: (id: ElementId): id is ManualProcessId =>
    id.startsWith(`${MANUAL_PROCESS_KIND}|`),
  match: <R>(id: ElementId, on: ElementIdHandlers<R>): R => {
    if (ElementId.isModule(id)) return on.module(id);
    if (ElementId.isBuildingBlock(id)) return on.buildingBlock(id);
    if (ElementId.isRule(id)) return on.rule(id);
    if (ElementId.isScenario(id)) return on.scenario(id);
    if (ElementId.isActor(id)) return on.actor(id);
    if (ElementId.isManualProcess(id)) return on.manualProcess(id);
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
  actor: (id: ActorId) => R;
  manualProcess: (id: ManualProcessId) => R;
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
