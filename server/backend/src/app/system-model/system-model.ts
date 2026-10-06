import { z } from 'zod';
import {
  BehaviorId,
  BuildingBlockId,
  ElementName,
  ModuleId,
} from '#backend/app/element-id';
import { SystemModelId } from './system-model-id';

export const BuildingBlockType = z.enum([
  'aggregate',
  'entity',
  'value_object',
  'domain_service',
  'application_service',
  'repository',
  'factory',
  'external_integration',
]);
export type BuildingBlockType = z.infer<typeof BuildingBlockType>;

export const RuleCategory = z
  .enum(['Business', 'Quality', 'Constraint'])
  .describe(
    "What a rule is: 'Business', a truth of the domain; 'Quality', a measurable quality the system must have (ISO/IEC 25010); 'Constraint', a limit imposed on the solution from outside the domain.",
  );
export type RuleCategory = z.infer<typeof RuleCategory>;

const BUSINESS_RULE_TYPES = [
  'Consistency',
  'Structure',
  'Computation',
  'State change',
] as const;
const QUALITY_RULE_TYPES = [
  'Performance',
  'Security',
  'Reliability',
  'Usability',
  'Compatibility',
  'Maintainability',
  'Portability',
] as const;
const CONSTRAINT_RULE_TYPES = [
  'Technology',
  'Regulation',
  'Interface',
  'Organisation',
] as const;

export const RuleType = z
  .enum([
    ...BUSINESS_RULE_TYPES,
    ...QUALITY_RULE_TYPES,
    ...CONSTRAINT_RULE_TYPES,
  ])
  .describe(
    `The kind of rule within its category. Business: ${BUSINESS_RULE_TYPES.join(', ')}. Quality: ${QUALITY_RULE_TYPES.join(', ')}. Constraint: ${CONSTRAINT_RULE_TYPES.join(', ')}.`,
  );
export type RuleType = z.infer<typeof RuleType>;

/** The rule types each category allows. */
export const RULE_TYPES_OF: Record<RuleCategory, readonly RuleType[]> = {
  Business: BUSINESS_RULE_TYPES,
  Quality: QUALITY_RULE_TYPES,
  Constraint: CONSTRAINT_RULE_TYPES,
};

export const BehaviourType = z.enum(['Command', 'Event', 'Query']);
export type BehaviourType = z.infer<typeof BehaviourType>;

const PRIMITIVE_KIND = 'primitive';
const PRIMITIVES = [
  'string',
  'integer',
  'decimal',
  'boolean',
  'date',
  'datetime',
  'duration',
  'uuid',
];
export const PrimitiveId = z
  .string()
  .regex(
    new RegExp(`^${PRIMITIVE_KIND}\\|(?:${PRIMITIVES.join('|')})$`),
    'Invalid PrimitiveId',
  )
  .describe(
    `A built-in building block's id: '${PRIMITIVE_KIND}|', then one of ${PRIMITIVES.join(', ')}, e.g. '${PRIMITIVE_KIND}|uuid'.`,
  )
  .brand<'PrimitiveId'>();
export type PrimitiveId = z.infer<typeof PrimitiveId>;

export interface Collection {
  collectionOf: BuildingBlockRef;
}

interface CollectionInput {
  collectionOf: BuildingBlockRefInput;
}

export const Collection: z.ZodType<Collection, CollectionInput> =
  z.strictObject({
    get collectionOf() {
      return BuildingBlockRef;
    },
  });

export type BuildingBlockRef = BuildingBlockId | PrimitiveId | Collection;
export type BuildingBlockRefInput = string | CollectionInput;

export const BuildingBlockRef: z.ZodType<
  BuildingBlockRef,
  BuildingBlockRefInput
> = z.union([BuildingBlockId, PrimitiveId, Collection]);

export const Visibility = z.discriminatedUnion('kind', [
  z.strictObject({ kind: z.literal('private') }),
  z.strictObject({ kind: z.literal('public'), actors: z.array(z.string()) }),
]);
export type Visibility = z.infer<typeof Visibility>;

export const SourceLocation = z.strictObject({
  path: z.string(),
  line: z.int().min(1).nullable().default(null),
});
export type SourceLocation = z.infer<typeof SourceLocation>;

export const ScannedProperty = z.strictObject({
  name: ElementName,
  type: BuildingBlockRef,
  description: z.string().nullable().default(null),
  optional: z.boolean().default(false),
});
export type ScannedProperty = z.infer<typeof ScannedProperty>;

export const ScannedParameter = z.strictObject({
  name: ElementName,
  type: BuildingBlockRef,
  description: z.string().nullable().default(null),
  optional: z.boolean().default(false),
});
export type ScannedParameter = z.infer<typeof ScannedParameter>;

/** What a behaviour gives back: known by its type, as it has no name. */
export const ScannedResult = ScannedParameter.omit({ name: true });
export type ScannedResult = z.infer<typeof ScannedResult>;

export const ScannedScenario = z.strictObject({
  name: ElementName,
  description: z.string(),
  given: z.string(),
  when: z.string(),
  // oxlint-disable-next-line unicorn/no-thenable
  then: z.string(), // NOSONAR
});
export type ScannedScenario = z.infer<typeof ScannedScenario>;

export const ScannedRule = z.strictObject({
  name: ElementName,
  category: RuleCategory.default('Business'),
  ruleType: RuleType,
  description: z.string().nullable().default(null),
  scenarios: z.array(ScannedScenario).default([]),
});
export type ScannedRule = z.infer<typeof ScannedRule>;

export const ScannedDomainModule = z.strictObject({
  id: ModuleId,
  name: ElementName,
  description: z.string().nullable().default(null),
  rules: z.array(ScannedRule).default([]),
  source: SourceLocation,
});
export type ScannedDomainModule = z.infer<typeof ScannedDomainModule>;

export const ScannedBuildingBlock = z.strictObject({
  id: BuildingBlockId,
  name: ElementName,
  type: BuildingBlockType,
  description: z.string().nullable().default(null),
  implements: z.array(BuildingBlockId).default([]),
  properties: z.array(ScannedProperty).default([]),
  rules: z.array(ScannedRule).default([]),
  scenarios: z.array(ScannedScenario).default([]),
  source: SourceLocation,
});
export type ScannedBuildingBlock = z.infer<typeof ScannedBuildingBlock>;

export const ScannedBehaviour = z.strictObject({
  id: BehaviorId,
  buildingBlockId: BuildingBlockId,
  name: ElementName,
  type: BehaviourType,
  description: z.string().nullable().default(null),
  visibility: Visibility,
  input: z.array(ScannedParameter).default([]),
  output: z.array(ScannedResult).default([]),
  rules: z.array(ScannedRule).default([]),
  scenarios: z.array(ScannedScenario).default([]),
  source: SourceLocation,
});
export type ScannedBehaviour = z.infer<typeof ScannedBehaviour>;

export const SystemModel = z
  .strictObject({
    id: SystemModelId,
    name: z.string(),
    scanned_at: z.string(),
    modules: z.array(ScannedDomainModule).default([]),
    buildingBlocks: z.array(ScannedBuildingBlock).default([]),
    behaviours: z.array(ScannedBehaviour).default([]),
  })
  .describe(
    'The implemented model as one scan found it: graph/system-models/<id>.system-model.json. Every scan is kept; the highest id is the newest.',
  );
export type SystemModel = z.infer<typeof SystemModel>;
