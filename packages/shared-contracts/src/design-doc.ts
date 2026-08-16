import { z } from 'zod';

/*
 * The portable design-document specification.
 *
 * Shape follows section 3 of docs/work/features/design-doc/plan.md: a
 * normalised accepted model with stable ids, explicit baseline references and
 * overlays, replacing the previous tree of `added/removed/modified` change
 * sets (specification §14.7).
 *
 * Two things are deliberately NOT in this file:
 *
 * - Collaboration objects — comments, suggestions and agent proposals — live
 *   in `design-doc-collaboration.ts`, because they reference the document by
 *   id rather than travelling inside it (specification §14.8).
 * - Codebase-relative state (`existing | new | modified | removed`) is
 *   derived, not stored. Elements carry a baseline snapshot and a removal
 *   intent; `design-doc-baseline.ts` turns those into a state.
 *
 * Every addressable element carries a stable `id`, unique across the whole
 * document. Ids are what comments, suggestions and agent context point at (see
 * `design-doc-ref.ts`), and what survives the reordering and renaming the
 * editor allows, so no element the document renders as its own block is
 * addressed by position.
 */

/* -------------------------------------------------------------- vocabulary */

/**
 * Whole-document lifecycle (specification §5). Individual use cases, building
 * blocks and scenarios have no separate workflow state.
 */
export const DesignDocumentStatusSchema = z.enum(['draft', 'implemented']);
export type DesignDocumentStatus = z.infer<typeof DesignDocumentStatusSchema>;

/**
 * Who wrote a piece of prose (specification §6.5). Shown as a quiet `person`
 * tag on the element rather than a badge on every field, and used by the agent
 * to decide what it may rewrite unasked.
 */
export const AuthorshipSchema = z.enum(['human', 'agent']);
export type Authorship = z.infer<typeof AuthorshipSchema>;

/**
 * Codebase-relative state (specification §2.6, decision 49). Derived from
 * baseline-comparable fields only, and never propagated upward through
 * containment. Declared here because it is part of the shared vocabulary;
 * computed in `design-doc-baseline.ts`.
 */
export const CodebaseStateSchema = z.enum([
  'existing',
  'new',
  'modified',
  'removed',
]);
export type CodebaseState = z.infer<typeof CodebaseStateSchema>;

export const DesignedActorKindSchema = z.enum(['human', 'system']);
export type DesignedActorKind = z.infer<typeof DesignedActorKindSchema>;

export const DesignedUseCaseTypeSchema = z.enum(['Command', 'Query', 'Event']);
export type DesignedUseCaseType = z.infer<typeof DesignedUseCaseTypeSchema>;

export const DesignedRuleTypeSchema = z.enum([
  'Consistency',
  'Structure',
  'Computation',
  'State change',
]);
export type DesignedRuleType = z.infer<typeof DesignedRuleTypeSchema>;

export const DesignedQualityAttributeTypeSchema = z.enum([
  'performance',
  'availability',
  'security',
  'other',
]);
export type DesignedQualityAttributeType = z.infer<
  typeof DesignedQualityAttributeTypeSchema
>;

export const DesignedBuildingBlockTypeSchema = z.enum([
  'aggregate',
  'entity',
  'value_object',
  'domain_event',
  'domain_command',
  'domain_query',
  'domain_service',
  'application_service',
  'repository',
  'factory',
  'external_integration',
]);
export type DesignedBuildingBlockType = z.infer<
  typeof DesignedBuildingBlockTypeSchema
>;

/* ---------------------------------------------------------------- baseline */

/**
 * One source-code scan. The document names the scan it is compared against and
 * whether a newer one is waiting; refreshing to it is an explicit user action,
 * never an automatic rebase (specification §14.9).
 */
export const BaselineScanSchema = z.object({
  scanId: z.string(),
  scannedAt: z.string(),
  repository: z.string(),
});
export type BaselineScan = z.infer<typeof BaselineScanSchema>;

export const BaselineRefSchema = z.object({
  active: BaselineScanSchema,
  newer: BaselineScanSchema.nullable().default(null),
});
export type BaselineRef = z.infer<typeof BaselineRefSchema>;

/**
 * How an element reconnects to future scans. `sourceRef` is the scanner's own
 * stable handle — a fully qualified name, a symbol id — so a rename in the
 * design document does not read as a new element on the next scan.
 */
export const ScannerIdentitySchema = z.object({
  scannerId: z.string(),
  sourceRef: z.string(),
});
export type ScannerIdentity = z.infer<typeof ScannerIdentitySchema>;

/* -------------------------------------------------------- leaf design types */

/**
 * One typed field, in one list per direction (plan §3.4). `label` is the
 * business wording and `name`/`type` the structural truth; both readerships
 * read the same row. Only `name`, `type` and the field set are
 * baseline-comparable — `label` and `note` are design-only (decision 49).
 */
export const DesignedFieldSchema = z.object({
  id: z.string(),
  name: z.string(),
  label: z.string(),
  type: z.string(),
  note: z.string().default(''),
});
export type DesignedField = z.infer<typeof DesignedFieldSchema>;

/**
 * A property of a building block — the structural half of the Technical lens.
 * Distinct from `DesignedField`, which is a use case's input or output: a field
 * carries business wording for the Product reader, a property does not.
 */
export const DesignedPropertySchema = z.object({
  id: z.string(),
  name: z.string(),
  type: z.string(),
  description: z.string().default(''),
  nullable: z.boolean().default(false),
  collection: z.boolean().default(false),
});
export type DesignedProperty = z.infer<typeof DesignedPropertySchema>;

export const DesignedRuleSchema = z.object({
  id: z.string(),
  text: z.string(),
  ruleType: DesignedRuleTypeSchema.nullable().default(null),
  author: AuthorshipSchema.default('agent'),
});
export type DesignedRule = z.infer<typeof DesignedRuleSchema>;

export const DesignedQualityAttributeSchema = z.object({
  id: z.string(),
  name: z.string(),
  text: z.string(),
  type: DesignedQualityAttributeTypeSchema.nullable().default(null),
  author: AuthorshipSchema.default('agent'),
});
export type DesignedQualityAttribute = z.infer<
  typeof DesignedQualityAttributeSchema
>;

/* ----------------------------------------------------------------- Gherkin */

export const GherkinKeywordSchema = z.enum([
  'Given',
  'When',
  'Then',
  'And',
  'But',
]);
export type GherkinKeyword = z.infer<typeof GherkinKeywordSchema>;

export const GherkinStepSchema = z.object({
  id: z.string(),
  keyword: GherkinKeywordSchema,
  text: z.string(),
});
export type GherkinStep = z.infer<typeof GherkinStepSchema>;

export const GherkinExampleRowSchema = z.object({
  id: z.string(),
  cells: z.array(z.string()).default([]),
});
export type GherkinExampleRow = z.infer<typeof GherkinExampleRowSchema>;

export const GherkinExamplesSchema = z.object({
  headers: z.array(z.string()).default([]),
  rows: z.array(GherkinExampleRowSchema).default([]),
});
export type GherkinExamples = z.infer<typeof GherkinExamplesSchema>;

/**
 * A Gherkin scenario. One shape serves both places the product writes them: a
 * use case's acceptance scenarios and a building-block behaviour's behavioural
 * scenarios (specification §14.3, §11.1). Ownership is what distinguishes them,
 * not structure — the Gherkin is the same Gherkin.
 *
 * `background` sits on the scenario rather than on its owner because that is
 * how the document renders it — a Background block immediately above the
 * scenario it sets up — and Background is a presentation of shared setup, not
 * an independently addressable element in this product.
 *
 * Scenario paths (specification §14.5) are deliberately absent: they exist to
 * feed sequence diagrams, which are deferred. Ids stay stable so paths can be
 * added later without re-anchoring anything.
 */
export const DesignedScenarioSchema = z.object({
  id: z.string(),
  title: z.string(),
  kind: z.enum(['scenario', 'scenarioOutline']).default('scenario'),
  tags: z.array(z.string()).default([]),
  background: z.array(GherkinStepSchema).default([]),
  steps: z.array(GherkinStepSchema).default([]),
  examples: GherkinExamplesSchema.nullable().default(null),
});
export type DesignedScenario = z.infer<typeof DesignedScenarioSchema>;

/** A Gherkin scenario owned by a use case, addressed as `acceptanceScenario[id]`. */
export const DesignedAcceptanceScenarioSchema = DesignedScenarioSchema;
export type DesignedAcceptanceScenario = DesignedScenario;

/* ---------------------------------------------------- document-level fields */

export const BusinessContextParagraphSchema = z.object({
  id: z.string(),
  text: z.string(),
});
export type BusinessContextParagraph = z.infer<
  typeof BusinessContextParagraphSchema
>;

export const TargetOutcomeSchema = z.object({
  id: z.string(),
  text: z.string(),
  measure: z.string().default(''),
});
export type TargetOutcome = z.infer<typeof TargetOutcomeSchema>;

export const ScopeItemSchema = z.object({
  id: z.string(),
  text: z.string(),
});
export type ScopeItem = z.infer<typeof ScopeItemSchema>;

export const DesignedScopeSchema = z.object({
  inScope: z.array(ScopeItemSchema).default([]),
  outOfScope: z.array(ScopeItemSchema).default([]),
});
export type DesignedScope = z.infer<typeof DesignedScopeSchema>;

/* --------------------------------------------------------------- structure */

export const DesignedActorComparableSchema = z.object({
  name: z.string(),
  kind: DesignedActorKindSchema,
});
export type DesignedActorComparable = z.infer<
  typeof DesignedActorComparableSchema
>;

export const DesignedActorBaselineSchema = z.object({
  scanId: z.string(),
  comparable: DesignedActorComparableSchema,
});
export type DesignedActorBaseline = z.infer<typeof DesignedActorBaselineSchema>;

/**
 * Actors stay minimal in this iteration (plan §3.2): identity, name, kind and
 * description, listed as a document section. Use cases reference them by id —
 * the many-to-many relationship the old `actor: string | null` could not carry
 * (specification §14.2).
 */
export const DesignedActorSchema = z.object({
  id: z.string(),
  name: z.string(),
  kind: DesignedActorKindSchema,
  description: z.string().default(''),
  scanner: ScannerIdentitySchema.nullable().default(null),
  baseline: DesignedActorBaselineSchema.nullable().default(null),
  markedForRemoval: z.boolean().default(false),
});
export type DesignedActor = z.infer<typeof DesignedActorSchema>;

export const DesignedBoundedContextComparableSchema = z.object({
  name: z.string(),
});
export type DesignedBoundedContextComparable = z.infer<
  typeof DesignedBoundedContextComparableSchema
>;

export const DesignedBoundedContextBaselineSchema = z.object({
  scanId: z.string(),
  comparable: DesignedBoundedContextComparableSchema,
});
export type DesignedBoundedContextBaseline = z.infer<
  typeof DesignedBoundedContextBaselineSchema
>;

export const DesignedBoundedContextSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().default(''),
  scanner: ScannerIdentitySchema.nullable().default(null),
  baseline: DesignedBoundedContextBaselineSchema.nullable().default(null),
  markedForRemoval: z.boolean().default(false),
});
export type DesignedBoundedContext = z.infer<
  typeof DesignedBoundedContextSchema
>;

export const DesignedDomainModuleComparableSchema = z.object({
  name: z.string(),
  boundedContextId: z.string(),
});
export type DesignedDomainModuleComparable = z.infer<
  typeof DesignedDomainModuleComparableSchema
>;

export const DesignedDomainModuleBaselineSchema = z.object({
  scanId: z.string(),
  comparable: DesignedDomainModuleComparableSchema,
});
export type DesignedDomainModuleBaseline = z.infer<
  typeof DesignedDomainModuleBaselineSchema
>;

/**
 * An optional grouping of building blocks inside a bounded context. The
 * document view does not read it — use cases group by application service —
 * but the Technical lens and the scanners do.
 */
export const DesignedDomainModuleSchema = z.object({
  id: z.string(),
  name: z.string(),
  boundedContextId: z.string(),
  description: z.string().default(''),
  scanner: ScannerIdentitySchema.nullable().default(null),
  baseline: DesignedDomainModuleBaselineSchema.nullable().default(null),
  markedForRemoval: z.boolean().default(false),
});
export type DesignedDomainModule = z.infer<typeof DesignedDomainModuleSchema>;

export const DesignedBuildingBlockComparableSchema = z.object({
  name: z.string(),
  type: DesignedBuildingBlockTypeSchema.nullable().default(null),
  boundedContextId: z.string(),
  domainModuleId: z.string().nullable().default(null),
  properties: z
    .array(z.object({ name: z.string(), type: z.string() }))
    .default([]),
});
export type DesignedBuildingBlockComparable = z.infer<
  typeof DesignedBuildingBlockComparableSchema
>;

export const DesignedBuildingBlockBaselineSchema = z.object({
  scanId: z.string(),
  comparable: DesignedBuildingBlockComparableSchema,
});
export type DesignedBuildingBlockBaseline = z.infer<
  typeof DesignedBuildingBlockBaselineSchema
>;

/**
 * A building block: aggregate, entity, repository, application service and the
 * rest of the tactical vocabulary.
 *
 * There is no separate application-service record. An application service is a
 * building block whose `type` is `application_service`, so
 * `UseCase.applicationServiceId` and `DesignedBehaviour.buildingBlockId` name
 * the same thing in one id space — the invariant a document-level check should
 * enforce is that a use case's `applicationServiceId` resolves to a block of
 * that type.
 *
 * Most of what the Technical lens does with these blocks — the architecture
 * graph, interaction flow — is deferred. The vocabulary is here so scanners and
 * behaviours have something to reference.
 */
export const DesignedBuildingBlockSchema = z.object({
  id: z.string(),
  name: z.string(),
  type: DesignedBuildingBlockTypeSchema.nullable().default(null),
  boundedContextId: z.string(),
  domainModuleId: z.string().nullable().default(null),
  description: z.string().default(''),
  implements: z.array(z.string()).default([]),
  properties: z.array(DesignedPropertySchema).default([]),
  scanner: ScannerIdentitySchema.nullable().default(null),
  baseline: DesignedBuildingBlockBaselineSchema.nullable().default(null),
  markedForRemoval: z.boolean().default(false),
});
export type DesignedBuildingBlock = z.infer<typeof DesignedBuildingBlockSchema>;

export const DesignedBehaviourComparableSchema = z.object({
  name: z.string(),
  type: DesignedUseCaseTypeSchema.nullable().default(null),
  buildingBlockId: z.string(),
});
export type DesignedBehaviourComparable = z.infer<
  typeof DesignedBehaviourComparableSchema
>;

export const DesignedBehaviourBaselineSchema = z.object({
  scanId: z.string(),
  comparable: DesignedBehaviourComparableSchema,
});
export type DesignedBehaviourBaseline = z.infer<
  typeof DesignedBehaviourBaselineSchema
>;

/**
 * One behaviour of one building block — `SlotHold.place()`, `BookAppointment`,
 * `AppointmentBooked`. Behaviours are the nodes of the invocation graph that
 * behaviour relationships connect (specification §14.4), which is why they
 * exist at every level and not only where a use case does.
 *
 * A behaviour that is a use case's entry point names it in `useCaseId`, and the
 * use case names the behaviour back in `behaviourId`. The two stay separate
 * types because they answer to different owners: a behaviour belongs to a
 * building block and carries no actors, while a use case belongs to an
 * application service, references actors and holds the document's acceptance
 * scenarios.
 *
 * Behaviour relationships themselves (§14.4) and scenario paths (§14.5) are not
 * modelled yet — they arrive with the Technical lens that reads them.
 */
export const DesignedBehaviourSchema = z.object({
  id: z.string(),
  name: z.string(),
  type: DesignedUseCaseTypeSchema.nullable().default(null),
  buildingBlockId: z.string(),
  /** Set only on the entry-point behaviour of a use case. */
  useCaseId: z.string().nullable().default(null),
  description: z.string().default(''),
  /** Behavioural scenarios (§11.1). Nothing renders them yet. */
  scenarios: z.array(DesignedScenarioSchema).default([]),
  scanner: ScannerIdentitySchema.nullable().default(null),
  baseline: DesignedBehaviourBaselineSchema.nullable().default(null),
  markedForRemoval: z.boolean().default(false),
});
export type DesignedBehaviour = z.infer<typeof DesignedBehaviourSchema>;

export const DesignedInputSchema = z.object({
  fields: z.array(DesignedFieldSchema).default([]),
});
export type DesignedInput = z.infer<typeof DesignedInputSchema>;

export const DesignedOutputSchema = z.object({
  summary: z.string().default(''),
  fields: z.array(DesignedFieldSchema).default([]),
});
export type DesignedOutput = z.infer<typeof DesignedOutputSchema>;

/**
 * The baseline-comparable projection of a use case: exactly the fields a
 * source-code scanner can populate (decision 49). Design-only fields — summary,
 * description, rules prose, quality attributes, acceptance scenarios — are
 * absent by construction, so they can never produce a Modified marker.
 */
export const DesignedUseCaseComparableSchema = z.object({
  name: z.string(),
  type: DesignedUseCaseTypeSchema.nullable().default(null),
  applicationServiceId: z.string().nullable().default(null),
  actorIds: z.array(z.string()).default([]),
  input: z.array(z.object({ name: z.string(), type: z.string() })).default([]),
  output: z.array(z.object({ name: z.string(), type: z.string() })).default([]),
});
export type DesignedUseCaseComparable = z.infer<
  typeof DesignedUseCaseComparableSchema
>;

/**
 * What the last scan saw of an element, kept so Modified can be explained
 * rather than merely asserted (specification §14.9). Absent means the element
 * has no counterpart in the baseline, which is what New means.
 */
export const DesignedUseCaseBaselineSchema = z.object({
  scanId: z.string(),
  comparable: DesignedUseCaseComparableSchema,
});
export type DesignedUseCaseBaseline = z.infer<
  typeof DesignedUseCaseBaselineSchema
>;

/**
 * A first-class use case (specification §14.1): stable identity, one owning
 * application service, a Command/Query/Event type, actor references, and
 * ownership of its rules, fields, scenarios and quality attributes.
 */
export const DesignedUseCaseSchema = z.object({
  id: z.string(),
  name: z.string(),
  type: DesignedUseCaseTypeSchema.nullable().default(null),
  /** A `DesignedBuildingBlock` whose type is `application_service`. */
  applicationServiceId: z.string().nullable().default(null),
  /** The behaviour this use case enters through, if the graph knows one. */
  behaviourId: z.string().nullable().default(null),
  actorIds: z.array(z.string()).default([]),
  summary: z.string().default(''),
  description: z.string().default(''),
  descriptionAuthor: AuthorshipSchema.default('agent'),
  rules: z.array(DesignedRuleSchema).default([]),
  input: DesignedInputSchema.default({ fields: [] }),
  output: DesignedOutputSchema.default({ summary: '', fields: [] }),
  acceptanceScenarios: z.array(DesignedAcceptanceScenarioSchema).default([]),
  qualityAttributes: z.array(DesignedQualityAttributeSchema).default([]),
  scanner: ScannerIdentitySchema.nullable().default(null),
  baseline: DesignedUseCaseBaselineSchema.nullable().default(null),
  /**
   * Removed is design intent applied to an element the baseline still contains
   * (specification §14.9), so the element stays in the document rather than
   * being deleted from it.
   */
  markedForRemoval: z.boolean().default(false),
});
export type DesignedUseCase = z.infer<typeof DesignedUseCaseSchema>;

/* ---------------------------------------------------------------- document */

/**
 * The whole portable specification, in the order the document reads: goal,
 * business context, target outcomes, scope, actors, then use cases grouped by
 * bounded context and application service (plan §1).
 */
export const DesignDocumentSchema = z.object({
  id: z.string(),
  name: z.string(),
  status: DesignDocumentStatusSchema.default('draft'),
  // ISO date (YYYY-MM-DD). Drives ordering on the design-docs page.
  date: z.string().default(() => new Date().toISOString().slice(0, 10)),
  goal: z.string().default(''),
  businessContext: z.array(BusinessContextParagraphSchema).default([]),
  outcomes: z.array(TargetOutcomeSchema).default([]),
  scope: DesignedScopeSchema.default({ inScope: [], outOfScope: [] }),
  actors: z.array(DesignedActorSchema).default([]),
  boundedContexts: z.array(DesignedBoundedContextSchema).default([]),
  domainModules: z.array(DesignedDomainModuleSchema).default([]),
  buildingBlocks: z.array(DesignedBuildingBlockSchema).default([]),
  useCases: z.array(DesignedUseCaseSchema).default([]),
  behaviours: z.array(DesignedBehaviourSchema).default([]),
  baseline: BaselineRefSchema.nullable().default(null),
});
export type DesignDocument = z.infer<typeof DesignDocumentSchema>;
