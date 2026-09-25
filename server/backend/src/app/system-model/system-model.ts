import { z } from 'zod';
import {
  BehaviorId,
  BuildingBlockId,
  ElementName,
  ModuleId,
} from '#backend/app/element-id';

export const BuildingBlockType = z.enum([
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
export type BuildingBlockType = z.infer<typeof BuildingBlockType>;

export const RuleType = z.enum([
  'Consistency',
  'Structure',
  'Computation',
  'State change',
]);
export type RuleType = z.infer<typeof RuleType>;

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

export const ScannedScenario = z.strictObject({
  name: ElementName,
  description: z.string(),
  given: z.string(),
  when: z.string(),
  // oxlint-disable-next-line unicorn/no-thenable
  then: z.string(), // NOSONAR
  // TODO: Czy scenariusz zawsze jest podpięty pod jeden element i wtedy powinien być na tym elemencie?
  testedElementIds: z.array(z.union([BuildingBlockId, BehaviorId])).default([]),
});
export type ScannedScenario = z.infer<typeof ScannedScenario>;

export const ScannedDomainModule = z.strictObject({
  id: ModuleId,
  name: ElementName,
  description: z.string().nullable().default(null),
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
  input: z.array(BuildingBlockRef).default([]),
  output: z.array(BuildingBlockRef).default([]),
  // TODO: Czy to jest potrzebne? Co z invokes?
  usedBuildingBlocks: z.array(BuildingBlockId).default([]),
  source: SourceLocation,
});
export type ScannedBehaviour = z.infer<typeof ScannedBehaviour>;

export const SystemModel = z
  .strictObject({
    id: z.string(),
    name: z.string(),
    scanned_at: z.string(),
    // TODO: 3 listy, czy jedna Elements?
    modules: z.array(ScannedDomainModule).default([]),
    buildingBlocks: z.array(ScannedBuildingBlock).default([]),
    behaviours: z.array(ScannedBehaviour).default([]),
  })
  .describe(
    'The implemented model of one scanned unit: graph/system-models/<id>.system-model.json, written by the scanner.',
  );
export type SystemModel = z.infer<typeof SystemModel>;
