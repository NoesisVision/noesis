import { z } from 'zod';
import type { Clock } from '#backend/app/clock';
import {
  ActorId,
  ArtifactName,
  BehaviorId,
  BuildingBlockId,
  DeployableUnitId,
  DeploymentContainerId,
  ElementName,
  LayerId,
  LibraryId,
  ManualProcessId,
  ModuleId,
  RuleId,
  ScenarioId,
} from '#backend/app/element-id';
import { isCollaboratorKind } from '#backend/app/scanners/system-model-builders/block-kinds';
import {
  BuildingBlockKind,
  Cardinality,
  ModuleContainsModuleRelation,
  ModuleContainsBlockRelation,
  ExposesRelation,
  ExtendsRelation,
  GovernsRelation,
  HasCollaboratorRelation,
  HasInputRelation,
  HasOutputRelation,
  HasStateRelation,
  ContainerContainsUnitRelation,
  IllustratesRelation,
  InvokesRelation,
  PerformsRelation,
  LayerContainsBlockRelation,
  LibraryContainsBlockRelation,
  UnitContainsModuleRelation,
  RuleKind,
  ScenarioSteps,
  type SystemModel,
  TypeId,
} from '#backend/app/system-model/system-model';
import { type ChangedDesignDocField, DesignDocField } from './design-doc-field';
import { DesignDocId } from './design-doc-id';
import { MermaidSource } from './mermaid-source';
import { NeedId } from './need-id';
import { type RelationKey, relationKeyOf } from './relation-key';

/** A stakeholder goal the design answers: who needs what, never a solution. */
export const DesignedNeed = z.strictObject({
  id: NeedId,
  name: DesignDocField(ElementName),
  stakeholder: DesignDocField(z.string()),
  statement: DesignDocField(z.string()),
});
export type DesignedNeed = z.infer<typeof DesignedNeed>;

export const DesignedScenario = z
  .strictObject({
    id: ScenarioId,
    name: DesignDocField(ElementName),
    description: DesignDocField(z.string()),
    steps: DesignDocField(ScenarioSteps),
  })
  .describe(
    "An example of a rule, as the Gherkin `Scenario:` under the rule's `Rule:` it becomes: its steps are the scenario's Given, When and Then steps. Its id is its rule's path and its name; an 'illustrates' relation joins it to the rule.",
  );
export type DesignedScenario = z.infer<typeof DesignedScenario>;

/*
 * A relation as a design writes it: the scanned shape, with what is not its
 * identity as fields, so a design may change a slot's type or cardinality,
 * or a call's order, or a parameter's position, without removing and adding
 * the relation. A named slot (`has_state`, `has_collaborator`, `has_input`,
 * `has_output`) is known by its holder and name, so its type is a field;
 * every other relation is known by its ends.
 */
/** A named slot's fields: what it points at, and how many of it. */
const designedSlot = <To extends z.ZodType>(to: To) => ({
  to: DesignDocField(to),
  cardinality: DesignDocField(Cardinality),
});
export const DesignedRelation = z.discriminatedUnion('kind', [
  ModuleContainsModuleRelation,
  ModuleContainsBlockRelation,
  UnitContainsModuleRelation,
  LibraryContainsBlockRelation,
  LayerContainsBlockRelation,
  ExtendsRelation,
  HasStateRelation.extend(designedSlot(TypeId)),
  HasCollaboratorRelation.extend(designedSlot(BuildingBlockId)),
  ExposesRelation,
  HasInputRelation.extend({
    ...designedSlot(TypeId),
    position: DesignDocField(HasInputRelation.shape.position),
  }),
  HasOutputRelation.extend(designedSlot(TypeId)),
  InvokesRelation.extend({
    order: DesignDocField(InvokesRelation.shape.order),
  }),
  GovernsRelation,
  IllustratesRelation,
  PerformsRelation,
  ContainerContainsUnitRelation,
]);
export type DesignedRelation = z.infer<typeof DesignedRelation>;

/** What a design removes a relation by: its kind and ends and, for a named slot, its name too, so the key says what was removed in full. */
export const DesignedRelationKey = z
  .discriminatedUnion('kind', [
    ModuleContainsModuleRelation.pick({ kind: true, from: true, to: true }),
    ModuleContainsBlockRelation.pick({ kind: true, from: true, to: true }),
    UnitContainsModuleRelation.pick({ kind: true, from: true, to: true }),
    LibraryContainsBlockRelation.pick({ kind: true, from: true, to: true }),
    LayerContainsBlockRelation.pick({ kind: true, from: true, to: true }),
    ExtendsRelation.pick({ kind: true, from: true, to: true }),
    HasStateRelation.pick({ kind: true, from: true, to: true, name: true }),
    HasCollaboratorRelation.pick({
      kind: true,
      from: true,
      to: true,
      name: true,
    }),
    ExposesRelation.pick({ kind: true, from: true, to: true }),
    HasInputRelation.pick({ kind: true, from: true, to: true, name: true }),
    HasOutputRelation.pick({ kind: true, from: true, to: true, name: true }),
    InvokesRelation.pick({ kind: true, from: true, to: true }),
    GovernsRelation.pick({ kind: true, from: true, to: true }),
    IllustratesRelation.pick({ kind: true, from: true, to: true }),
    PerformsRelation.pick({ kind: true, from: true, to: true }),
    ContainerContainsUnitRelation.pick({ kind: true, from: true, to: true }),
  ])
  .describe(
    "A relation by its kind, `from` and `to`, as the model has it; a named slot ('has_state', 'has_collaborator', 'has_input' and 'has_output', whose name is 'result') carries its `name` too, and is known by that rather than by `to`.",
  );
export type DesignedRelationKey = z.infer<typeof DesignedRelationKey>;

export const DesignedRule = z
  .strictObject({
    id: RuleId,
    name: DesignDocField(ElementName),
    kind: DesignDocField(RuleKind),
    description: DesignDocField(z.string()),
    needs: DesignDocField(
      z
        .array(NeedId)
        .describe(
          'The needs of this design document the rule answers; empty for a design decision no need asks for.',
        ),
    ),
    rationale: DesignDocField(z.string()),
  })
  .describe(
    "A rule a behavior follows, as the Gherkin `Rule:` it becomes: its name the `Rule:` line, its description the text under it, its kind the tag on it. Its id is the path of the module of the behavior that governs it, then its name; a 'governs' relation from each behavior that follows it joins them.",
  );
export type DesignedRule = z.infer<typeof DesignedRule>;

export const DesignedDomainModule = z.strictObject({
  id: ModuleId,
  name: DesignDocField(ElementName),
  definition: DesignDocField(z.string()),
  diagram: DesignDocField(MermaidSource),
});
export type DesignedDomainModule = z.infer<typeof DesignedDomainModule>;

export const DesignedBuildingBlock = z.strictObject({
  id: BuildingBlockId,
  name: DesignDocField(ElementName),
  type: DesignDocField(BuildingBlockKind),
  definition: DesignDocField(z.string()),
  diagram: DesignDocField(MermaidSource),
});
export type DesignedBuildingBlock = z.infer<typeof DesignedBuildingBlock>;

export const DesignedBehavior = z.strictObject({
  id: BehaviorId,
  name: DesignDocField(ElementName),
  definition: DesignDocField(z.string()),
  diagram: DesignDocField(MermaidSource),
});
export type DesignedBehavior = z.infer<typeof DesignedBehavior>;

export const DesignedActor = z
  .strictObject({
    id: ActorId,
    name: DesignDocField(ElementName),
    definition: DesignDocField(z.string()),
  })
  .describe(
    "A person or role outside the code who drives the system: a 'performs' relation names the manual processes they carry out.",
  );
export type DesignedActor = z.infer<typeof DesignedActor>;

export const DesignedManualProcess = z
  .strictObject({
    id: ManualProcessId,
    name: DesignDocField(ElementName),
    definition: DesignDocField(z.string()),
  })
  .describe(
    "Work an actor does by hand, outside the code: its 'invokes' relations are the behaviors it calls, in order, and a 'performs' relation names who does it. Never scanned.",
  );
export type DesignedManualProcess = z.infer<typeof DesignedManualProcess>;

export const DesignedDeployableUnit = z
  .strictObject({
    id: DeployableUnitId,
    name: DesignDocField(ArtifactName),
    definition: DesignDocField(z.string()),
  })
  .describe(
    "Something built and shipped as one piece (a service, a runnable JAR, an executable assembly): its 'unit_contains_module' relations name the modules in it. Scanned from the build's executable artifacts, named as the build names them.",
  );
export type DesignedDeployableUnit = z.infer<typeof DesignedDeployableUnit>;

export const DesignedLibrary = z
  .strictObject({
    id: LibraryId,
    name: DesignDocField(ArtifactName),
    definition: DesignDocField(z.string()),
  })
  .describe(
    "A reusable package of building blocks: its 'library_contains_block' relations name the blocks in it. Scanned from the build's artifacts that are no executable, named as the build names them.",
  );
export type DesignedLibrary = z.infer<typeof DesignedLibrary>;

export const DesignedLayer = z
  .strictObject({
    id: LayerId,
    name: DesignDocField(ElementName),
    definition: DesignDocField(z.string()),
  })
  .describe(
    "A horizontal slice of the code (domain, application, infrastructure, …): its 'layer_contains_block' relations name the building blocks in it. Scanned from the layer annotations on packages and namespaces (Java's on package-info.java).",
  );
export type DesignedLayer = z.infer<typeof DesignedLayer>;

export const DesignedDeploymentContainer = z
  .strictObject({
    id: DeploymentContainerId,
    name: DesignDocField(ElementName),
    definition: DesignDocField(z.string()),
  })
  .describe(
    "Where deployable units run (a cluster, a server, a serverless platform): its 'container_contains_unit' relations name the units it runs. Never scanned.",
  );
export type DesignedDeploymentContainer = z.infer<
  typeof DesignedDeploymentContainer
>;

const designDocumentSchema = z.strictObject({
  id: DesignDocId.describe(
    "The design document id: its creation date, then its name as lower-case kebab-case, e.g. '2026-09-24-partial-refunds'; unique within the change. Minted by the server when the design document is created and never changed, even when the name is.",
  ),
  name: z.string().describe('The design document name.'),
  description: z
    .string()
    .describe(
      "The design's overview, read first when it is opened: a short guide to its changes in the model, from the general to the particular, in Markdown of at most about 60 lines and no diagrams. States facts the design shows or its sources state, and cites the source for every reason. Links elements with 'noesis:' and the element's id, e.g. '[Refund](noesis:building_block|sales.refunds.Refund)', an id with a space in angle brackets, e.g. '[Paid orders only](<noesis:rule|sales.orders.Paid orders only>)', and needs with 'noesis:need|' and the need's id.",
    ),
  needs: changeSet(DesignedNeed, NeedId),
  modules: changeSet(DesignedDomainModule, ModuleId),
  buildingBlocks: changeSet(DesignedBuildingBlock, BuildingBlockId),
  behaviors: changeSet(DesignedBehavior, BehaviorId),
  rules: changeSet(DesignedRule, RuleId),
  scenarios: changeSet(DesignedScenario, ScenarioId),
  actors: changeSet(DesignedActor, ActorId),
  manualProcesses: changeSet(DesignedManualProcess, ManualProcessId),
  deployableUnits: changeSet(DesignedDeployableUnit, DeployableUnitId),
  libraries: changeSet(DesignedLibrary, LibraryId),
  layers: changeSet(DesignedLayer, LayerId),
  deploymentContainers: changeSet(
    DesignedDeploymentContainer,
    DeploymentContainerId,
  ),
  relations: changeSet(DesignedRelation, DesignedRelationKey).describe(
    "The relations the design adds, removes or changes between elements of the design or the model: what a block holds as state ('has_state') or works with ('has_collaborator', a block that is no value of the domain), extends or exposes, what a behavior takes ('has_input'), gives back ('has_output') and calls ('invokes'), which modules a module contains ('module_contains_module') and which building blocks it declares ('module_contains_block'), which modules a deployable unit ships ('unit_contains_module'), which building blocks a library provides ('library_contains_block') or a layer places ('layer_contains_block'), which deployable units a deployment container hosts ('container_contains_unit'), which rules a behavior follows ('governs'), which scenarios illustrate a rule ('illustrates'), which manual processes an actor performs ('performs') and which behaviors a manual process calls, in order ('invokes'). Both ends of an added relation exist, in the design or the model; a 'module_contains_module', a 'module_contains_block', an 'exposes' or an 'illustrates' agrees with the ids, whose paths already say what holds what; an added rule is governed by a behavior.",
  ),
  implemented: z
    .boolean()
    .default(false)
    .describe('Whether the design is marked as implemented.'),
  implementedAt: z.iso
    .datetime()
    .nullable()
    .default(null)
    .describe(
      'When the design was marked as implemented, as an ISO 8601 UTC instant the server stamps. Null while it is not, and on a design marked before the server kept the time.',
    ),
});

export const DesignDocument = Object.assign(designDocumentSchema, {
  /** A human may write a field in their own name. */
  validateHumanEdited: rulesOfEveryDesign,
  /**
   * An agent never writes a field in a human's name. Revising `before`, it
   * keeps a field a human wrote or accepted there, value and author, as long
   * as it leaves the field alone.
   */
  validateAgentGenerated: (
    document: DesignDocumentContent,
    systemModel?: SystemModel,
    before?: DesignDocumentContent,
  ): DesignDocViolation[] => [
    ...rulesOfEveryDesign(document, systemModel),
    ...humanAuthoredFieldsNotKept(document, before),
    ...diagramsInDefinitions(document),
  ],
});
export type DesignDocument = z.infer<typeof designDocumentSchema>;

/** Why a design document is refused, as the error body names it. */
export const DesignDocViolationReason = z.enum([
  'changedInGreenField',
  'unknownElement',
  'unchangedFieldInAddedItem',
  'humanAuthor',
  'diagramInDefinition',
  'unknownNeed',
  'ungovernedRule',
  'unknownRelationEnd',
  'containmentOutsideIdPath',
  'slotOutsideTypeKind',
]);
export type DesignDocViolationReason = z.infer<typeof DesignDocViolationReason>;

export interface DesignDocViolation {
  path: string;
  reason: DesignDocViolationReason;
}

export type DesignDocumentInput = z.input<typeof designDocumentSchema>;

/** The working file of a design document: the server mints the id of a new one; an update names it beside the file. */
// TODO: Czy to jest optymalne rozwiązanie? Może przenieść jako kontrakt serwisu aplikacyjnego - command CreateDesignDocument.
export const DesignDocumentContent = designDocumentSchema.omit({
  id: true,
  implementedAt: true,
});
export type DesignDocumentContent = z.infer<typeof DesignDocumentContent>;

/**
 * When the design became implemented: stamped as it is marked, kept while it
 * stays marked, cleared when it is not.
 */
export function implementedAtOf(
  design: DesignDocumentContent,
  before: DesignDocument | null,
  clock: Clock,
): string | null {
  if (!design.implemented) return null;
  return before?.implemented ? before.implementedAt : clock.now();
}

export type DesignedDomainModuleInput = z.input<typeof DesignedDomainModule>;
export type DesignedBuildingBlockInput = z.input<typeof DesignedBuildingBlock>;
export type DesignedBehaviorInput = z.input<typeof DesignedBehavior>;
export type DesignedActorInput = z.input<typeof DesignedActor>;
export type DesignedManualProcessInput = z.input<typeof DesignedManualProcess>;
export type DesignedDeployableUnitInput = z.input<
  typeof DesignedDeployableUnit
>;
export type DesignedLibraryInput = z.input<typeof DesignedLibrary>;
export type DesignedLayerInput = z.input<typeof DesignedLayer>;
export type DesignedDeploymentContainerInput = z.input<
  typeof DesignedDeploymentContainer
>;
export type DesignedRelationInput = z.input<typeof DesignedRelation>;
export type DesignedRelationKeyInput = z.input<typeof DesignedRelationKey>;
export type DesignedRuleInput = z.input<typeof DesignedRule>;
export type DesignedNeedInput = z.input<typeof DesignedNeed>;
export type DesignedScenarioInput = z.input<typeof DesignedScenario>;

type ChangeSet<
  Item extends z.ZodType,
  Key extends z.ZodType = never,
> = z.ZodPrefault<
  z.ZodObject<
    [Key] extends [never]
      ? {
          added: z.ZodDefault<z.ZodArray<Item>>;
          removed: z.ZodDefault<z.ZodArray<Item>>;
        }
      : {
          added: z.ZodDefault<z.ZodArray<Item>>;
          removed: z.ZodDefault<z.ZodArray<Key>>;
          modified: z.ZodDefault<z.ZodArray<Item>>;
        },
    z.core.$strict
  >
>;

function changeSet<Item extends z.ZodType>(item: Item): ChangeSet<Item>;
function changeSet<Item extends z.ZodType, Key extends z.ZodType>(
  item: Item,
  key: Key,
): ChangeSet<Item, Key>;
function changeSet(item: z.ZodType, key?: z.ZodType) {
  if (key === undefined) {
    return z
      .strictObject({
        added: z.array(item).default([]),
        removed: z.array(item).default([]),
      })
      .prefault({});
  }
  return z
    .strictObject({
      added: z.array(item).default([]),
      removed: z.array(key).default([]),
      modified: z.array(item).default([]),
    })
    .prefault({});
}

/**
 * Every element, part or relation the document modifies or removes, at any
 * level, that the system model lacks; all of them in a green field. An
 * element is matched by its id, a relation by its key. Inside an added
 * element nothing exists yet.
 */
function changesMissingFrom(
  systemModel: SystemModel | undefined,
  document: DesignDocumentContent,
): DesignDocViolation[] {
  const reason =
    systemModel === undefined ? 'changedInGreenField' : 'unknownElement';
  return [...partsMissingFrom(document, systemModel, '')].map((path) => ({
    path,
    reason,
  }));
}

function* partsMissingFrom(
  designed: object,
  scanned: object | undefined,
  path: string,
): Generator<string> {
  for (const [name, part] of Object.entries(designed)) {
    if (!isChangeSet(part)) continue;
    const counterpart: unknown =
      scanned === undefined ? undefined : Reflect.get(scanned, name);
    yield* changesMissingFromPart(
      part,
      Array.isArray(counterpart) ? counterpart : [],
      path === '' ? name : `${path}.${name}`,
    );
  }
}

function* changesMissingFromPart(
  changes: ChangeSetValue,
  scanned: unknown[],
  path: string,
): Generator<string> {
  const known = new Map(scanned.map((item) => [keyOf(item), item]));
  for (const item of changes.added) {
    if (isObject(item)) {
      yield* partsMissingFrom(item, undefined, `${path}.added[${keyOf(item)}]`);
    }
  }
  for (const key of changes.removed.map(keyOf)) {
    if (!known.has(key)) yield `${path}.removed[${key}]`;
  }
  for (const item of changes.modified ?? []) {
    const key = keyOf(item);
    const found = known.get(key);
    if (found === undefined) {
      yield `${path}.modified[${key}]`;
    } else if (isObject(item)) {
      yield* partsMissingFrom(
        item,
        isObject(found) ? found : undefined,
        `${path}.modified[${key}]`,
      );
    }
  }
}

interface ChangeSetValue {
  added: unknown[];
  removed: unknown[];
  modified?: unknown[];
}

function isChangeSet(value: unknown): value is ChangeSetValue {
  return (
    isObject(value) &&
    'added' in value &&
    Array.isArray(value.added) &&
    'removed' in value &&
    Array.isArray(value.removed)
  );
}

function isObject(value: unknown): value is object {
  return typeof value === 'object' && value !== null;
}

/**
 * The rules a design document follows, whoever wrote it. Without a system
 * model it is a green field: there is nothing to modify or remove.
 */
function rulesOfEveryDesign(
  document: DesignDocumentContent,
  systemModel?: SystemModel,
): DesignDocViolation[] {
  return [
    ...changesMissingFrom(systemModel, document),
    ...unchangedFieldsInAddedItems(document),
    ...unknownNeeds(document),
    ...ungovernedRules(document),
    ...unknownRelationEnds(document, systemModel),
    ...containmentsOutsideIdPaths(document),
    ...slotsOutsideTypeKinds(document, systemModel),
  ];
}

const ELEMENT_LISTS = [
  'modules',
  'buildingBlocks',
  'behaviors',
  'rules',
  'scenarios',
  'actors',
  'manualProcesses',
  'deployableUnits',
  'libraries',
  'layers',
  'deploymentContainers',
] as const;

/** Both ends of an added relation are elements the design adds or the model has; a primitive is always known. */
function unknownRelationEnds(
  document: DesignDocumentContent,
  systemModel: SystemModel | undefined,
): DesignDocViolation[] {
  const known = new Set<string>();
  for (const list of ELEMENT_LISTS) {
    for (const { id } of systemModel?.[list] ?? []) known.add(id);
    for (const { id } of document[list].added) known.add(id);
  }
  const unknown = (id: string | undefined) =>
    id !== undefined && !known.has(id) && !id.startsWith('primitive|');
  return document.relations.added.flatMap((relation) => {
    const to = DesignDocField.is(relation.to)
      ? relation.to.changed
        ? relation.to.value
        : undefined
      : relation.to;
    return [
      ...(unknown(relation.from) ? ['from'] : []),
      ...(unknown(to) ? ['to'] : []),
    ].map((end) => ({
      path: `relations.added[${relationKeyOf(relation)}].${end}`,
      reason: 'unknownRelationEnd' as const,
    }));
  });
}

/**
 * What holds what is in the ids: a `module_contains_module`, a `module_contains_block` or an `exposes`
 * says what `to`'s path already says, an `illustrates` what `from`'s does.
 */
function containmentsOutsideIdPaths(
  document: DesignDocumentContent,
): DesignDocViolation[] {
  return document.relations.added
    .filter((relation) => {
      if (
        relation.kind === 'module_contains_module' ||
        relation.kind === 'module_contains_block' ||
        relation.kind === 'exposes'
      )
        return parentPathOf(relation.to) !== pathOf(relation.from);
      if (relation.kind === 'illustrates')
        return parentPathOf(relation.from) !== pathOf(relation.to);
      return false;
    })
    .map((relation) => ({
      path: `relations.added[${relationKeyOf(relation)}]`,
      reason: 'containmentOutsideIdPath' as const,
    }));
}

/**
 * The kind of the block a slot points at says which slot it is: a value of
 * the domain or a primitive is state, any other block a collaborator. A type
 * neither the design nor the model gives a kind passes.
 */
function slotsOutsideTypeKinds(
  document: DesignDocumentContent,
  systemModel: SystemModel | undefined,
): DesignDocViolation[] {
  const kinds = new Map<string, BuildingBlockKind>();
  for (const { id, type } of systemModel?.buildingBlocks ?? [])
    kinds.set(id, type);
  for (const kind of ['added', 'modified'] as const)
    for (const { id, type } of document.buildingBlocks[kind])
      if (type.changed) kinds.set(id, type.value);
  const scannedTo = new Map(
    (systemModel?.relations ?? []).map((relation) => [
      relationKeyOf(relation),
      relation.to,
    ]),
  );
  return (['added', 'modified'] as const).flatMap((change) =>
    document.relations[change].flatMap((relation) => {
      if (relation.kind !== 'has_state' && relation.kind !== 'has_collaborator')
        return [];
      const key = relationKeyOf(relation);
      const to = relation.to.changed ? relation.to.value : scannedTo.get(key);
      if (to === undefined) return [];
      const kind = kinds.get(to);
      const collaborator = to.startsWith('primitive|')
        ? false
        : kind === undefined
          ? null
          : isCollaboratorKind(kind);
      if (collaborator === null) return [];
      return collaborator === (relation.kind === 'has_collaborator')
        ? []
        : [
            {
              path: `relations.${change}[${key}].kind`,
              reason: 'slotOutsideTypeKind' as const,
            },
          ];
    }),
  );
}

const pathOf = (id: string) => id.slice(id.indexOf('|') + 1);
const parentPathOf = (id: string) =>
  pathOf(id).split('.').slice(0, -1).join('.');

/** A rule enters the model only through a behavior: an added rule is governed by one the design names. */
function ungovernedRules(
  document: DesignDocumentContent,
): DesignDocViolation[] {
  const governed = new Set<string>(
    document.relations.added.flatMap((relation) =>
      relation.kind === 'governs' ? [relation.to] : [],
    ),
  );
  return document.rules.added
    .filter(({ id }) => !governed.has(id))
    .map(({ id }) => ({
      path: `rules.added[${id}]`,
      reason: 'ungovernedRule' as const,
    }));
}

/** A rule traces only to needs this design document states. */
function unknownNeeds(document: DesignDocumentContent): DesignDocViolation[] {
  const stated = new Set<string>(document.needs.added.map(({ id }) => id));
  return (['added', 'modified'] as const).flatMap((change) =>
    document.rules[change].flatMap(({ id, needs }) =>
      needs.changed
        ? needs.value
            .filter((need) => !stated.has(need))
            .map((need) => ({
              path: `rules.${change}[${id}].needs[${need}]`,
              reason: 'unknownNeed' as const,
            }))
        : [],
    ),
  );
}

/**
 * Fields an added element may leave out: the model never has them, so there
 * is nothing for the design to keep.
 */
const OPTIONAL_FIELDS = new Set(['diagram', 'rationale']);

function unchangedFieldsInAddedItems(
  document: DesignDocumentContent,
): DesignDocViolation[] {
  return [...fieldsOf(document, '')]
    .filter(
      ([path, field]) =>
        !field.changed && isInAddedItem(path) && !isOptionalField(path),
    )
    .map(([path]) => ({ path, reason: 'unchangedFieldInAddedItem' }));
}

function isOptionalField(path: string): boolean {
  return OPTIONAL_FIELDS.has(path.slice(path.lastIndexOf('.') + 1));
}

/** The fence a diagram is written in inside markdown. */
const MERMAID_FENCE = /^ {0,3}(?:`{3,}|~{3,})[^\n]*\bmermaid\b/mu;

/**
 * An element with a diagram of its own draws it there, not in a fence of its
 * definition.
 */
function diagramsInDefinitions(
  document: DesignDocumentContent,
): DesignDocViolation[] {
  const collections = {
    modules: document.modules,
    buildingBlocks: document.buildingBlocks,
    behaviors: document.behaviors,
  };
  return Object.entries(collections).flatMap(([name, changes]) =>
    (['added', 'modified'] as const).flatMap((kind) =>
      changes[kind]
        .filter(
          ({ definition }) =>
            definition.changed && MERMAID_FENCE.test(definition.value),
        )
        .map(({ id }) => ({
          path: `${name}.${kind}[${id}].definition`,
          reason: 'diagramInDefinition' as const,
        })),
    ),
  );
}

function humanAuthoredFieldsNotKept(
  document: DesignDocumentContent,
  before: DesignDocumentContent | undefined,
): DesignDocViolation[] {
  const kept = new Map(
    before === undefined
      ? []
      : [...fieldsOf(before, '')].filter(([, field]) => isHumanAuthored(field)),
  );
  return [...fieldsOf(document, '')]
    .filter(
      ([path, field]) =>
        isHumanAuthored(field) && !sameValue(field, kept.get(path)),
    )
    .map(([path]) => ({ path, reason: 'humanAuthor' }));
}

function isHumanAuthored(
  field: DesignDocField<unknown>,
): field is ChangedDesignDocField<unknown> {
  return field.changed && field.author === 'human';
}

function sameValue(
  field: ChangedDesignDocField<unknown>,
  stored: DesignDocField<unknown> | undefined,
): boolean {
  return stored?.changed === true && deepEqual(field.value, stored.value);
}

function deepEqual(left: unknown, right: unknown): boolean {
  if (Object.is(left, right)) return true;
  if (!isObject(left) || !isObject(right)) return false;
  if (Array.isArray(left) !== Array.isArray(right)) return false;
  const keys = Object.keys(left);
  return (
    keys.length === Object.keys(right).length &&
    keys.every((key) =>
      deepEqual(Reflect.get(left, key), Reflect.get(right, key)),
    )
  );
}

function isInAddedItem(path: string): boolean {
  return /(?:^|\.)added\[/.test(path);
}

function* fieldsOf(
  node: unknown,
  path: string,
): Generator<[string, DesignDocField<unknown>]> {
  if (DesignDocField.is(node)) {
    yield [path, node];
  } else if (Array.isArray(node)) {
    for (const item of node) yield* fieldsOf(item, `${path}[${keyOf(item)}]`);
  } else if (typeof node === 'object' && node !== null) {
    for (const [name, child] of Object.entries(node)) {
      yield* fieldsOf(child, path === '' ? name : `${path}.${name}`);
    }
  }
}

function keyOf(item: unknown): string {
  if (typeof item !== 'object' || item === null) return String(item);
  if ('id' in item && typeof item.id === 'string') return item.id;
  if (isRelationKey(item)) return relationKeyOf(item);
  if ('name' in item && typeof item.name === 'string') return item.name;
  return JSON.stringify(item);
}

/** A relation, designed or scanned, or the key one is removed by. */
function isRelationKey(item: object): item is RelationKey {
  return (
    'kind' in item &&
    typeof item.kind === 'string' &&
    'from' in item &&
    typeof item.from === 'string' &&
    'to' in item
  );
}
