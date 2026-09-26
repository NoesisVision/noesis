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
        'The document title, free text. Two documents may share one; the id tells them apart.',
      ),
    date: z.iso
      .date()
      .describe(
        'When the document was written or last revised, ISO 8601 date (YYYY-MM-DD). Independent of when it was added.',
      ),
    content: z
      .string()
      .describe('The document text, verbatim. Revised whenever it changes.'),
  })
  .describe('A document of a change, as its change file holds it.');
export type SourceDocument = z.infer<typeof SourceDocument>;

/** The working file an agent writes: a document without its id, which the server mints. */
export const SourceDocumentFile = SourceDocument.omit({ id: true });
export type SourceDocumentFile = z.infer<typeof SourceDocumentFile>;
