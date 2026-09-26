import { z } from 'zod';
import { SourceDocumentId } from './source-document-id';

export const SourceDocument = z
  .object({
    id: SourceDocumentId.describe(
      "The document id: its creation date, then its title as lower-case kebab-case, e.g. '2026-09-24-payment-retry'; unique within the change. Minted by the server when the document is created and never changed, so it keeps the original title.",
    ),
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
        'When the document was written or last revised, ISO 8601 date (YYYY-MM-DD). Independent of the creation date in the id.',
      ),
    content: z
      .string()
      .describe('The document text, verbatim. Revised whenever it changes.'),
  })
  .describe(
    'A document of a change: the working file an agent writes, and graph/changes/<change>/<id>.document.json.',
  );
export type SourceDocument = z.infer<typeof SourceDocument>;

/** The working file of a new document: the server mints its id. */
export const CreateSourceDocument = SourceDocument.omit({ id: true });
export type CreateSourceDocument = z.infer<typeof CreateSourceDocument>;

/** The working file of a document update: the id travels beside it. */
export const UpdateSourceDocument = SourceDocument.omit({ id: true });
export type UpdateSourceDocument = z.infer<typeof UpdateSourceDocument>;
