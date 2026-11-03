import { z } from 'zod';
import { ArtifactName, ElementName } from '#backend/app/element-id';
import { BuildingBlockType } from '#backend/app/system-model/system-model';

/*
 * A library the scan does not read, described by hand: one file under
 * `.noesis/libraries/`, naming the library and the building blocks in it
 * (R14 of docs/plans/code-model-to-system-model.md). The code reaches such
 * a library only as stubs, which carry no annotations; the manifest says
 * what the stubs are, so a field, a parameter, a result or a base typed by
 * one resolves to a block of the model. The adapter reads the files; this
 * is their shape.
 */

/** A type as the code model spells it, without the `T:`: `MyCompany.Shared.Money`, `Result`1`, `Order+Line`. */
const TypeName = z
  .string()
  .regex(/^[^\s:|]+$/)
  .describe(
    "The type's full name as the code model spells it, without its 'T:' prefix: its namespace or package and its name, e.g. 'MyCompany.Shared.Money'; a generic type with its arity, 'Result`1'; a nested type after a '+', 'Order+Line'.",
  );

const LibraryManifestBlock = z.strictObject({
  type: TypeName,
  kind: BuildingBlockType,
  name: ElementName.optional().describe(
    "The block's name in the model; the type's own name by default.",
  ),
  description: z.string().optional(),
});

/** Strict, so a misspelt key fails instead of being dropped unread. */
export const LibraryManifestSchema = z.strictObject({
  name: ArtifactName.describe(
    'The library as its build names it, e.g. the package id: MyCompany.Shared.Kernel.',
  ),
  description: z.string().optional(),
  buildingBlocks: z.array(LibraryManifestBlock).min(1),
});

/** A manifest as read, with where it was read from. */
export interface LibraryManifest extends z.infer<typeof LibraryManifestSchema> {
  /** The file, relative to the repository root: `.noesis/libraries/shared-kernel.json`. */
  readonly path: string;
}
