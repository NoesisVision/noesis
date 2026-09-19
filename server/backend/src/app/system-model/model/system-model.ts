import { z } from 'zod';
import {
  DesignedBehaviourSchema,
  DesignedBoundedContextSchema,
  DesignedBuildingBlockSchema,
  DesignedDomainModuleSchema,
} from '../../design-docs/model/design-doc';

/*
 * The implemented model: what the source code actually contains, projected by
 * the scanner into objects under `.noesis/graph/system-model/`. It uses the same
 * structural vocabulary as a design document — bounded contexts, modules,
 * building blocks, behaviours — so a design can be read as a diff against it,
 * and every element carries where in the code it was found.
 *
 * The scanner writes these files; nobody edits them by hand, and no field is
 * ever locked. Granularity (one file per scanned unit) is fixed by the
 * scanner pipeline.
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

export const ScannedBoundedContextSchema = DesignedBoundedContextSchema.extend(
  scanned,
).describe('A bounded context as found in the code.');
export type ScannedBoundedContext = z.infer<typeof ScannedBoundedContextSchema>;

export const ScannedDomainModuleSchema = DesignedDomainModuleSchema.extend(
  scanned,
).describe('A domain module as found in the code.');
export type ScannedDomainModule = z.infer<typeof ScannedDomainModuleSchema>;

export const ScannedBuildingBlockSchema = DesignedBuildingBlockSchema.extend(
  scanned,
).describe('A building block as found in the code.');
export type ScannedBuildingBlock = z.infer<typeof ScannedBuildingBlockSchema>;

export const ScannedBehaviourSchema = DesignedBehaviourSchema.extend(
  scanned,
).describe('A behaviour of a building block as found in the code.');
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
