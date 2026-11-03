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

const ACTOR_KIND = 'actor';
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

const MANUAL_PROCESS_KIND = 'manual_process';
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

const LAYER_KIND = 'layer';
const layerIdSchema = z
  .string()
  .regex(topLevelIdPattern(LAYER_KIND), 'Invalid LayerId')
  .describe(
    "A layer's id: 'layer|', then its name, e.g. 'layer|domain'; layers belong to no module.",
  )
  .brand<'LayerId'>();
export const LayerId = Object.assign(layerIdSchema, {
  of: (name: string) =>
    layerIdSchema.parse(`${LAYER_KIND}|${ElementName.parse(name)}`),
});
export type LayerId = z.infer<typeof layerIdSchema>;

const DEPLOYMENT_CONTAINER_KIND = 'deployment_container';
const deploymentContainerIdSchema = z
  .string()
  .regex(
    topLevelIdPattern(DEPLOYMENT_CONTAINER_KIND),
    'Invalid DeploymentContainerId',
  )
  .describe(
    "A deployment container's id: 'deployment_container|', then its name, e.g. 'deployment_container|Orders cluster'; deployment containers belong to no module.",
  )
  .brand<'DeploymentContainerId'>();
export const DeploymentContainerId = Object.assign(
  deploymentContainerIdSchema,
  {
    of: (name: string) =>
      deploymentContainerIdSchema.parse(
        `${DEPLOYMENT_CONTAINER_KIND}|${ElementName.parse(name)}`,
      ),
  },
);
export type DeploymentContainerId = z.infer<typeof deploymentContainerIdSchema>;

/*
 * A deployable unit or a library is a build artifact, named as the build
 * names it: `MyCompany.Sales.Api` is one name, so its dots are part of it.
 * It holds nothing by its path, so its id is its kind and that one name.
 */
const ARTIFACT_NAME = String.raw`[^|\s](?:[^|]*[^|\s])?`;

export const ArtifactName = z
  .string()
  .regex(new RegExp(`^${ARTIFACT_NAME}$`))
  .describe(
    "The name of a deployable unit or a library, as its build names it, e.g. 'MyCompany.Sales.Api' or 'shop-domain': never empty, never padded with whitespace, never containing '|'; dots are part of the name.",
  );
export type ArtifactName = z.infer<typeof ArtifactName>;

const artifactIdPattern = (kind: string) =>
  new RegExp(`^${kind}\\|${ARTIFACT_NAME}$`);

const DEPLOYABLE_UNIT_KIND = 'deployable_unit';
const deployableUnitIdSchema = z
  .string()
  .regex(artifactIdPattern(DEPLOYABLE_UNIT_KIND), 'Invalid DeployableUnitId')
  .describe(
    "A deployable unit's id: 'deployable_unit|', then its name, e.g. 'deployable_unit|shop-api'; dots are part of the name.",
  )
  .brand<'DeployableUnitId'>();
export const DeployableUnitId = Object.assign(deployableUnitIdSchema, {
  of: (name: string) =>
    deployableUnitIdSchema.parse(
      `${DEPLOYABLE_UNIT_KIND}|${ArtifactName.parse(name)}`,
    ),
});
export type DeployableUnitId = z.infer<typeof deployableUnitIdSchema>;

const LIBRARY_KIND = 'library';
const libraryIdSchema = z
  .string()
  .regex(artifactIdPattern(LIBRARY_KIND), 'Invalid LibraryId')
  .describe(
    "A library's id: 'library|', then its name, e.g. 'library|MyCompany.Sales.DeepModel'; dots are part of the name.",
  )
  .brand<'LibraryId'>();
export const LibraryId = Object.assign(libraryIdSchema, {
  of: (name: string) =>
    libraryIdSchema.parse(`${LIBRARY_KIND}|${ArtifactName.parse(name)}`),
});
export type LibraryId = z.infer<typeof libraryIdSchema>;

const elementIdSchema = z.union([
  moduleIdSchema,
  buildingBlockIdSchema,
  behaviorIdSchema,
  ruleIdSchema,
  scenarioIdSchema,
  actorIdSchema,
  manualProcessIdSchema,
  deployableUnitIdSchema,
  libraryIdSchema,
  layerIdSchema,
  deploymentContainerIdSchema,
]);
export const ElementId = Object.assign(elementIdSchema, {
  /** The element's own name: the last segment of its path, or a whole artifact name. */
  nameOf: (id: ElementId): string =>
    ElementId.isDeployableUnit(id) || ElementId.isLibrary(id)
      ? pathOf(id)
      : pathOf(id).split('.').at(-1)!,
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
  isDeployableUnit: (id: ElementId): id is DeployableUnitId =>
    id.startsWith(`${DEPLOYABLE_UNIT_KIND}|`),
  isLibrary: (id: ElementId): id is LibraryId =>
    id.startsWith(`${LIBRARY_KIND}|`),
  isLayer: (id: ElementId): id is LayerId => id.startsWith(`${LAYER_KIND}|`),
  isDeploymentContainer: (id: ElementId): id is DeploymentContainerId =>
    id.startsWith(`${DEPLOYMENT_CONTAINER_KIND}|`),
  match: <R>(id: ElementId, on: ElementIdHandlers<R>): R => {
    if (ElementId.isModule(id)) return on.module(id);
    if (ElementId.isBuildingBlock(id)) return on.buildingBlock(id);
    if (ElementId.isRule(id)) return on.rule(id);
    if (ElementId.isScenario(id)) return on.scenario(id);
    if (ElementId.isActor(id)) return on.actor(id);
    if (ElementId.isManualProcess(id)) return on.manualProcess(id);
    if (ElementId.isDeployableUnit(id)) return on.deployableUnit(id);
    if (ElementId.isLibrary(id)) return on.library(id);
    if (ElementId.isLayer(id)) return on.layer(id);
    if (ElementId.isDeploymentContainer(id)) return on.deploymentContainer(id);
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
  deployableUnit: (id: DeployableUnitId) => R;
  library: (id: LibraryId) => R;
  layer: (id: LayerId) => R;
  deploymentContainer: (id: DeploymentContainerId) => R;
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
