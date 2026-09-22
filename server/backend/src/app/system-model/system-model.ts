import { z } from 'zod';
import {
  DesignedBehaviourTypeSchema,
  DesignedBuildingBlockTypeSchema,
} from '#backend/app/design-docs/design-doc';

/*
 * The implemented model a design is a diff against. It shares the design
 * vocabulary for the kinds of elements, but none of the review machinery:
 * only the scanner writes these files, never edited by hand, no field ever
 * locked. Ids are the scanner's own, unique across the file, and every `*Id`
 * field names an element of the expected kind in the same file.
 */

export const SourceLocationSchema = z
  .object({
    path: z
      .string()
      .describe('The source file, relative to the repository root.'),
    line: z
      .int()
      .nullable()
      .default(null)
      .describe('The 1-based line where the element is declared, when known.'),
  })
  .describe('Where in the code an element was found.');
export type SourceLocation = z.infer<typeof SourceLocationSchema>;

const scanned = {
  source: SourceLocationSchema.nullable()
    .default(null)
    .describe('Where the scanner found this element; null when inferred.'),
};

export const ScannedPropertySchema = z
  .object({
    name: z.string().describe('The property name as code spells it.'),
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
  .describe('One property of a building block, as found in the code.');
export type ScannedProperty = z.infer<typeof ScannedPropertySchema>;

export const ScannedBoundedContextSchema = z
  .object({
    id: z.string().describe('Unique across the file.'),
    name: z.string().describe('The bounded context name.'),
    description: z
      .string()
      .default('')
      .describe('What the context is responsible for.'),
    ...scanned,
  })
  .describe('A bounded context as found in the code.');
export type ScannedBoundedContext = z.infer<typeof ScannedBoundedContextSchema>;

export const ScannedDomainModuleSchema = z
  .object({
    id: z.string().describe('Unique across the file.'),
    name: z.string().describe('The module name.'),
    boundedContextId: z
      .string()
      .describe('The id of the bounded context the module belongs to.'),
    description: z.string().default('').describe('What the module groups.'),
    ...scanned,
  })
  .describe('A domain module as found in the code.');
export type ScannedDomainModule = z.infer<typeof ScannedDomainModuleSchema>;

export const ScannedBuildingBlockSchema = z
  .object({
    id: z.string().describe('Unique across the file.'),
    name: z.string().describe('The block name as code spells it.'),
    type: DesignedBuildingBlockTypeSchema.nullable()
      .default(null)
      .describe('The tactical kind, or null when not recognised.'),
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
      .array(ScannedPropertySchema)
      .default([])
      .describe('The structural properties of the block.'),
    ...scanned,
  })
  .describe('A building block as found in the code.');
export type ScannedBuildingBlock = z.infer<typeof ScannedBuildingBlockSchema>;

export const ScannedBehaviourSchema = z
  .object({
    id: z.string().describe('Unique across the file.'),
    name: z.string().describe('The behaviour name as code spells it.'),
    type: DesignedBehaviourTypeSchema.nullable()
      .default(null)
      .describe('Command, Query or Event, or null when not classified.'),
    buildingBlockId: z
      .string()
      .describe('The id of the building block that owns the behaviour.'),
    description: z.string().default('').describe('What the behaviour does.'),
    ...scanned,
  })
  .describe('A behaviour of a building block as found in the code.');
export type ScannedBehaviour = z.infer<typeof ScannedBehaviourSchema>;

export const SystemModelSchema = z
  .object({
    id: z
      .string()
      .describe(
        'The id of this scanned unit; stable across scans of the same unit.',
      ),
    name: z
      .string()
      .describe(
        'What was scanned, as a title: a package, a service, a module.',
      ),
    scanned_at: z.string().describe('When the scan ran, ISO 8601 with offset.'),
    scanner: z
      .object({
        name: z.string().describe('The scanner that produced this file.'),
        version: z.string().describe('Its version.'),
      })
      .describe('Provenance of the file.'),
    boundedContexts: z
      .array(ScannedBoundedContextSchema)
      .default([])
      .describe('The bounded contexts found.'),
    domainModules: z
      .array(ScannedDomainModuleSchema)
      .default([])
      .describe('The domain modules found, each naming its bounded context.'),
    buildingBlocks: z
      .array(ScannedBuildingBlockSchema)
      .default([])
      .describe('The building blocks found, each naming its bounded context.'),
    behaviours: z
      .array(ScannedBehaviourSchema)
      .default([])
      .describe('The behaviours found, each naming its building block.'),
  })
  .describe(
    'The implemented model of one scanned unit: the data.json of graph/system-model/<id>/, written by the scanner.',
  );
export type SystemModel = z.infer<typeof SystemModelSchema>;
