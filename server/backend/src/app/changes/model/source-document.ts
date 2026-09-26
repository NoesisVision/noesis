import { z } from 'zod';
import { SourceDocumentId } from './source-document-id';

export const SourceDocument = z
  .object({
    id: SourceDocumentId,
    title: z
      .string()
      .trim()
      .min(1)
      .max(200)
      .describe(
        'The source document title, free text. Two may share one; the id tells them apart.',
      ),
    date: z.iso
      .date()
      .describe(
        'When the source document was written or last revised, ISO 8601 date (YYYY-MM-DD). Independent of when it was added.',
      ),
    content: z
      .string()
      .describe(
        'The source document text, verbatim. Revised whenever it changes.',
      ),
  })
  .describe('A source document of a change, as its change file holds it.');
export type SourceDocument = z.infer<typeof SourceDocument>;

/** The working file of a new source document: the server mints its id. */
export const CreateSourceDocument = SourceDocument.omit({ id: true });
export type CreateSourceDocument = z.infer<typeof CreateSourceDocument>;

/**
 * The working file of a source document update: the same shape, the id
 * travelling beside it.
 * @alias
 */
export const UpdateSourceDocument = CreateSourceDocument;
export type UpdateSourceDocument = CreateSourceDocument;
