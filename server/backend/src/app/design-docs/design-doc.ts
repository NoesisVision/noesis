import { z } from 'zod';

/*
 * No baseline diff against the system model yet.
 *
 * Ids are non-empty and unique across the whole document, and every `*Id`
 * field must name an existing element of the expected kind; the service
 * checks this on every write.
 */

/** Only the whole document has a status; its elements have none. */
export const DesignDocumentStatusSchema = z
  .enum(['draft', 'implemented'])
  .describe(
    'draft: the design is being worked on; implemented: the code matches it.',
  );
export type DesignDocumentStatus = z.infer<typeof DesignDocumentStatusSchema>;

export const AuthorshipSchema = z
  .enum(['human', 'agent'])
  .describe(
    'Who wrote the text: human (a person; do not rewrite it unasked) or agent.',
  );
export type Authorship = z.infer<typeof AuthorshipSchema>;

export const DesignedActorKindSchema = z
  .enum(['human', 'system'])
  .describe('human: a person or role; system: another software system.');
export type DesignedActorKind = z.infer<typeof DesignedActorKindSchema>;

export const DesignedUseCaseTypeSchema = z
  .enum(['Command', 'Query', 'Event'])
  .describe(
    'Command: changes state on request; Query: answers a question without changing state; Event: reacts to something that happened.',
  );
export type DesignedUseCaseType = z.infer<typeof DesignedUseCaseTypeSchema>;

export const DesignedRuleTypeSchema = z
  .enum(['Consistency', 'Structure', 'Computation', 'State change'])
  .describe(
    'Consistency: an invariant that must hold; Structure: what data must be present or shaped like; Computation: how a value is derived; State change: what a transition does.',
  );
export type DesignedRuleType = z.infer<typeof DesignedRuleTypeSchema>;

export const DesignedQualityAttributeTypeSchema = z
  .enum(['performance', 'availability', 'security', 'other'])
  .describe('The quality the attribute constrains.');
export type DesignedQualityAttributeType = z.infer<
  typeof DesignedQualityAttributeTypeSchema
>;

export const DesignedBuildingBlockTypeSchema = z
  .enum([
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
  ])
  .describe(
    'The tactical DDD kind of the block. A use case belongs to an application_service.',
  );
export type DesignedBuildingBlockType = z.infer<
  typeof DesignedBuildingBlockTypeSchema
>;

export const DesignedFieldSchema = z
  .object({
    id: z.string().describe('Unique across the document.'),
    name: z.string().describe('The field name as code will spell it.'),
    label: z.string().describe('The field as the business calls it.'),
    type: z.string().describe('The type, in the language of the model.'),
    note: z
      .string()
      .default('')
      .describe('Constraints or meaning worth a line; empty when obvious.'),
  })
  .describe('One input or output field of a use case.');
export type DesignedField = z.infer<typeof DesignedFieldSchema>;

export const DesignedPropertySchema = z
  .object({
    id: z.string().describe('Unique across the document.'),
    name: z.string().describe('The property name as code will spell it.'),
    type: z.string().describe('The type, in the language of the model.'),
    description: z
      .string()
      .default('')
      .describe('What the property holds; empty when the name says it.'),
    nullable: z
      .boolean()
      .default(false)
      .describe('True when the property may be absent.'),
    collection: z
      .boolean()
      .default(false)
      .describe('True when the property holds many values of `type`.'),
  })
  .describe('One property of a building block.');
export type DesignedProperty = z.infer<typeof DesignedPropertySchema>;

export const DesignedRuleSchema = z
  .object({
    id: z.string().describe('Unique across the document.'),
    text: z
      .string()
      .describe('The rule, as one sentence a domain expert would say.'),
    ruleType: DesignedRuleTypeSchema.nullable()
      .default(null)
      .describe('The kind of rule, or null when not classified.'),
    author: AuthorshipSchema.default('agent'),
  })
  .describe('A business rule a use case must respect.');
export type DesignedRule = z.infer<typeof DesignedRuleSchema>;

export const DesignedQualityAttributeSchema = z
  .object({
    id: z.string().describe('Unique across the document.'),
    name: z.string().describe('A short name for the attribute.'),
    text: z.string().describe('The requirement, measurable where possible.'),
    type: DesignedQualityAttributeTypeSchema.nullable()
      .default(null)
      .describe('The quality it constrains, or null when not classified.'),
    author: AuthorshipSchema.default('agent'),
  })
  .describe('A non-functional requirement on a use case.');
export type DesignedQualityAttribute = z.infer<
  typeof DesignedQualityAttributeSchema
>;

export const GherkinKeywordSchema = z
  .enum(['Given', 'When', 'Then', 'And', 'But'])
  .describe('The Gherkin step keyword.');
export type GherkinKeyword = z.infer<typeof GherkinKeywordSchema>;

export const GherkinStepSchema = z
  .object({
    id: z.string().describe('Unique across the document.'),
    keyword: GherkinKeywordSchema,
    text: z.string().describe('The step text after the keyword.'),
  })
  .describe('One Gherkin step.');
export type GherkinStep = z.infer<typeof GherkinStepSchema>;

export const GherkinExampleRowSchema = z
  .object({
    id: z.string().describe('Unique across the document.'),
    cells: z
      .array(z.string())
      .default([])
      .describe('One value per header, in header order.'),
  })
  .describe('One row of an examples table.');
export type GherkinExampleRow = z.infer<typeof GherkinExampleRowSchema>;

export const GherkinExamplesSchema = z
  .object({
    headers: z
      .array(z.string())
      .default([])
      .describe(
        'The placeholder names the outline steps use, in column order.',
      ),
    rows: z
      .array(GherkinExampleRowSchema)
      .default([])
      .describe('The rows; every row has as many cells as there are headers.'),
  })
  .describe('The examples table of a scenario outline.');
export type GherkinExamples = z.infer<typeof GherkinExamplesSchema>;

/**
 * `background` sits on the scenario, not its owner, because the document
 * renders it directly above the scenario it sets up.
 */
export const DesignedScenarioSchema = z
  .object({
    id: z.string().describe('Unique across the document.'),
    title: z.string().describe('The scenario title.'),
    kind: z
      .enum(['scenario', 'scenarioOutline'])
      .default('scenario')
      .describe(
        'scenario: concrete steps; scenarioOutline: steps with <placeholders> filled from `examples`.',
      ),
    tags: z
      .array(z.string())
      .default([])
      .describe('Gherkin tags without the @.'),
    background: z
      .array(GherkinStepSchema)
      .default([])
      .describe('Shared setup steps rendered above the scenario.'),
    steps: z
      .array(GherkinStepSchema)
      .default([])
      .describe('The scenario steps, in order.'),
    examples: GherkinExamplesSchema.nullable()
      .default(null)
      .describe(
        'The examples table; required for a scenarioOutline, null for a plain scenario.',
      ),
  })
  .describe('A Gherkin scenario, owned by a use case or a behaviour.');
export type DesignedScenario = z.infer<typeof DesignedScenarioSchema>;

/** @alias */
export const DesignedAcceptanceScenarioSchema = DesignedScenarioSchema;
export type DesignedAcceptanceScenario = DesignedScenario;

export const BusinessContextParagraphSchema = z
  .object({
    id: z.string().describe('Unique across the document.'),
    text: z.string().describe('One paragraph of business context.'),
  })
  .describe('One paragraph of the business context section.');
export type BusinessContextParagraph = z.infer<
  typeof BusinessContextParagraphSchema
>;

export const TargetOutcomeSchema = z
  .object({
    id: z.string().describe('Unique across the document.'),
    text: z.string().describe('The outcome the change should bring about.'),
    measure: z
      .string()
      .default('')
      .describe('How the outcome will be measured; empty when not yet known.'),
  })
  .describe('One target outcome of the change.');
export type TargetOutcome = z.infer<typeof TargetOutcomeSchema>;

export const ScopeItemSchema = z
  .object({
    id: z.string().describe('Unique across the document.'),
    text: z.string().describe('One thing that is in, or out of, scope.'),
  })
  .describe('One scope item.');
export type ScopeItem = z.infer<typeof ScopeItemSchema>;

export const DesignedScopeSchema = z
  .object({
    inScope: z
      .array(ScopeItemSchema)
      .default([])
      .describe('What the change covers.'),
    outOfScope: z
      .array(ScopeItemSchema)
      .default([])
      .describe('What it deliberately leaves out.'),
  })
  .describe('The scope section.');
export type DesignedScope = z.infer<typeof DesignedScopeSchema>;

export const DesignedActorSchema = z
  .object({
    id: z.string().describe('Unique across the document.'),
    name: z.string().describe('The actor as the business names it.'),
    kind: DesignedActorKindSchema,
    description: z
      .string()
      .default('')
      .describe('Who or what the actor is; empty when the name says it.'),
  })
  .describe('Someone or something that triggers or receives use cases.');
export type DesignedActor = z.infer<typeof DesignedActorSchema>;

export const DesignedBoundedContextSchema = z
  .object({
    id: z.string().describe('Unique across the document.'),
    name: z.string().describe('The bounded context name.'),
    description: z
      .string()
      .default('')
      .describe('What the context is responsible for.'),
  })
  .describe('A bounded context: one model, one ubiquitous language.');
export type DesignedBoundedContext = z.infer<
  typeof DesignedBoundedContextSchema
>;

/** The document view ignores modules; the Technical lens and scanners use them. */
export const DesignedDomainModuleSchema = z
  .object({
    id: z.string().describe('Unique across the document.'),
    name: z.string().describe('The module name.'),
    boundedContextId: z
      .string()
      .describe('The id of the bounded context the module belongs to.'),
    description: z.string().default('').describe('What the module groups.'),
  })
  .describe('A grouping of building blocks inside a bounded context.');
export type DesignedDomainModule = z.infer<typeof DesignedDomainModuleSchema>;

/**
 * There is no separate application-service record: an application service is a
 * building block of type `application_service`.
 */
export const DesignedBuildingBlockSchema = z
  .object({
    id: z.string().describe('Unique across the document.'),
    name: z.string().describe('The block name as code will spell it.'),
    type: DesignedBuildingBlockTypeSchema.nullable()
      .default(null)
      .describe('The tactical kind, or null when not yet decided.'),
    boundedContextId: z
      .string()
      .describe('The id of the bounded context the block belongs to.'),
    domainModuleId: z
      .string()
      .nullable()
      .default(null)
      .describe('The id of the module the block sits in, or null.'),
    description: z
      .string()
      .default('')
      .describe('What the block is responsible for.'),
    implements: z
      .array(z.string())
      .default([])
      .describe(
        'Ids of the blocks (interfaces, contracts) this one implements.',
      ),
    properties: z
      .array(DesignedPropertySchema)
      .default([])
      .describe('The structural properties of the block.'),
  })
  .describe('A building block of the model.');
export type DesignedBuildingBlock = z.infer<typeof DesignedBuildingBlockSchema>;

/**
 * Behaviours are the nodes of the invocation graph, so they exist on any block,
 * not only where a use case enters.
 */
export const DesignedBehaviourSchema = z
  .object({
    id: z.string().describe('Unique across the document.'),
    name: z.string().describe('The behaviour name as code will spell it.'),
    type: DesignedUseCaseTypeSchema.nullable()
      .default(null)
      .describe('Command, Query or Event, or null when not classified.'),
    buildingBlockId: z
      .string()
      .describe('The id of the building block that owns the behaviour.'),
    useCaseId: z
      .string()
      .nullable()
      .default(null)
      .describe(
        'Set only on the entry-point behaviour of a use case: that use case’s id.',
      ),
    description: z.string().default('').describe('What the behaviour does.'),
    scenarios: z
      .array(DesignedScenarioSchema)
      .default([])
      .describe('Behavioural scenarios of this behaviour.'),
  })
  .describe('One behaviour of one building block.');
export type DesignedBehaviour = z.infer<typeof DesignedBehaviourSchema>;

export const DesignedInputSchema = z
  .object({
    fields: z
      .array(DesignedFieldSchema)
      .default([])
      .describe('The input fields.'),
  })
  .describe('What a use case takes.');
export type DesignedInput = z.infer<typeof DesignedInputSchema>;

export const DesignedOutputSchema = z
  .object({
    summary: z.string().default('').describe('One line on what comes out.'),
    fields: z
      .array(DesignedFieldSchema)
      .default([])
      .describe('The output fields.'),
  })
  .describe('What a use case produces.');
export type DesignedOutput = z.infer<typeof DesignedOutputSchema>;

export const DesignedUseCaseSchema = z
  .object({
    id: z.string().describe('Unique across the document.'),
    name: z
      .string()
      .describe('The use case name, verb first: "Book appointment".'),
    type: DesignedUseCaseTypeSchema.nullable()
      .default(null)
      .describe('Command, Query or Event, or null when not classified.'),
    applicationServiceId: z
      .string()
      .nullable()
      .default(null)
      .describe(
        'The id of a building block of type application_service that owns the use case, or null.',
      ),
    behaviourId: z
      .string()
      .nullable()
      .default(null)
      .describe(
        'The id of the behaviour this use case enters through; that behaviour’s useCaseId must point back.',
      ),
    actorIds: z
      .array(z.string())
      .default([])
      .describe('Ids of the actors involved, each at most once.'),
    summary: z
      .string()
      .default('')
      .describe('One line on what the use case achieves.'),
    description: z
      .string()
      .default('')
      .describe('The narrative: trigger, main flow, outcome.'),
    descriptionAuthor: AuthorshipSchema.default('agent'),
    rules: z
      .array(DesignedRuleSchema)
      .default([])
      .describe('Business rules the use case enforces.'),
    input: DesignedInputSchema.default({ fields: [] }),
    output: DesignedOutputSchema.default({ summary: '', fields: [] }),
    acceptanceScenarios: z
      .array(DesignedAcceptanceScenarioSchema)
      .default([])
      .describe('Gherkin scenarios that define done.'),
    qualityAttributes: z
      .array(DesignedQualityAttributeSchema)
      .default([])
      .describe('Non-functional requirements on the use case.'),
  })
  .describe('A use case of the design.');
export type DesignedUseCase = z.infer<typeof DesignedUseCaseSchema>;

/** Fields follow the order the document reads. */
export const DesignDocumentSchema = z
  .object({
    id: z
      .string()
      .describe(
        'The document id. The service mints it on create; whatever is sent is replaced.',
      ),
    name: z.string().describe('The document title.'),
    status: DesignDocumentStatusSchema.default('draft'),
    date: z
      .string()
      .describe(
        'The date of the design, ISO 8601 (YYYY-MM-DD). Drives ordering on the design-docs page.',
      ),
    goal: z
      .string()
      .default('')
      .describe('One paragraph: what the change is for.'),
    businessContext: z
      .array(BusinessContextParagraphSchema)
      .default([])
      .describe('Why now, in a few paragraphs.'),
    outcomes: z
      .array(TargetOutcomeSchema)
      .default([])
      .describe('What should be true when the change lands.'),
    scope: DesignedScopeSchema.default({ inScope: [], outOfScope: [] }),
    actors: z
      .array(DesignedActorSchema)
      .default([])
      .describe('Everyone and everything the use cases involve.'),
    boundedContexts: z
      .array(DesignedBoundedContextSchema)
      .default([])
      .describe('The bounded contexts the design touches.'),
    domainModules: z
      .array(DesignedDomainModuleSchema)
      .default([])
      .describe('Optional groupings inside the bounded contexts.'),
    buildingBlocks: z
      .array(DesignedBuildingBlockSchema)
      .default([])
      .describe('The building blocks of the design.'),
    useCases: z
      .array(DesignedUseCaseSchema)
      .default([])
      .describe('The use cases, each owned by an application service.'),
    behaviours: z
      .array(DesignedBehaviourSchema)
      .default([])
      .describe('The behaviours of the building blocks.'),
  })
  .describe(
    'A design document: the data.json of graph/changes/<change>/design-docs/<id>/.',
  );
export type DesignDocument = z.infer<typeof DesignDocumentSchema>;
