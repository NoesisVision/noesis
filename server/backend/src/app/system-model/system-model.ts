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

export const PrimitiveType = z.enum([
  'string',
  'integer',
  'decimal',
  'boolean',
  'date',
  'datetime',
  'duration',
  'uuid',
]);
export type PrimitiveType = z.infer<typeof PrimitiveType>;

export type BuildingBlockRef =
  | BuildingBlockId
  | { primitive: PrimitiveType }
  | { collectionOf: BuildingBlockRef };
export type BuildingBlockRefInput =
  | string
  | { primitive: PrimitiveType }
  | { collectionOf: BuildingBlockRefInput };

export const BuildingBlockRef: z.ZodType<
  BuildingBlockRef,
  BuildingBlockRefInput
> = z.union([
  BuildingBlockId,
  z.object({ primitive: PrimitiveType }),
  z.object({
    get collectionOf() {
      return BuildingBlockRef;
    },
  }),
]);

export const Visibility = z.discriminatedUnion('kind', [
  z.strictObject({ kind: z.literal('private') }),
  z.object({ kind: z.literal('public'), actors: z.array(z.string()) }),
]);
export type Visibility = z.infer<typeof Visibility>;

export const SourceLocation = z.object({
  path: z.string(),
  line: z.int().min(1).nullable().default(null),
});
export type SourceLocation = z.infer<typeof SourceLocation>;

export const ScannedProperty = z.object({
  name: ElementName,
  type: BuildingBlockRef,
  description: z.string().nullable().default(null),
  optional: z.boolean().default(false),
});
export type ScannedProperty = z.infer<typeof ScannedProperty>;

export const ScannedScenario = z.object({
  name: ElementName,
  description: z.string(),
  given: z.string(),
  when: z.string(),
  // oxlint-disable-next-line unicorn/no-thenable
  then: z.string(), // NOSONAR
  testedElementIds: z.array(z.union([BuildingBlockId, BehaviorId])).default([]),
});
export type ScannedScenario = z.infer<typeof ScannedScenario>;

export const ScannedDomainModule = z.object({
  id: ModuleId,
  name: ElementName,
  description: z.string().nullable().default(null),
  source: SourceLocation,
});
export type ScannedDomainModule = z.infer<typeof ScannedDomainModule>;

export const ScannedBuildingBlock = z.object({
  id: BuildingBlockId,
  name: ElementName,
  type: BuildingBlockType,
  description: z.string().nullable().default(null),
  implements: z.array(BuildingBlockId).default([]),
  properties: z.array(ScannedProperty).default([]),
  source: SourceLocation,
});
export type ScannedBuildingBlock = z.infer<typeof ScannedBuildingBlock>;

export const ScannedBehaviour = z.object({
  id: BehaviorId,
  name: ElementName,
  type: BehaviourType,
  description: z.string().nullable().default(null),
  visibility: Visibility,
  input: z.array(BuildingBlockRef).default([]),
  output: z.array(BuildingBlockRef).default([]),
  usedBuildingBlocks: z.array(BuildingBlockId).default([]),
  scenarios: z.array(ScannedScenario).default([]),
  source: SourceLocation,
});
export type ScannedBehaviour = z.infer<typeof ScannedBehaviour>;

export const SystemModel = z
  .object({
    id: z.string(),
    name: z.string(),
    scanned_at: z.string(),
    modules: z.array(ScannedDomainModule).default([]),
    buildingBlocks: z.array(ScannedBuildingBlock).default([]),
    behaviours: z.array(ScannedBehaviour).default([]),
  })
  .describe(
    'The implemented model of one scanned unit: graph/system-models/<id>.system-model.json, written by the scanner.',
  );
export type SystemModel = z.infer<typeof SystemModel>;

export type SystemModelInput = z.input<typeof SystemModel>;
