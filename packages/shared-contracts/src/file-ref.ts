import { z } from 'zod';

/*
 * A reference from one knowledge graph file to another.
 *
 * Files under `.noesis/` point at each other by id, and every such link also
 * records the hash of the referenced file at the time the link was made. When
 * the hash no longer matches the file on disk the dependent has gone stale —
 * the mechanism that survives a branch switch or a hand edit, with no central
 * bookkeeping.
 */

export const FileRefSchema = z
  .object({
    id: z
      .string()
      .describe('The id of the referenced entity, as written in its own file.'),
    hash: z
      .string()
      .describe(
        'SHA-256 hex digest of the referenced file at link time. A mismatch against the file on disk marks this reference stale.',
      ),
  })
  .describe('A link to another knowledge graph file, pinned to its content.');
export type FileRef = z.infer<typeof FileRefSchema>;
