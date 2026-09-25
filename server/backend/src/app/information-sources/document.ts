import { z } from 'zod';
import { DocumentId } from './document-id';

export const DocumentSchema = z
  .object({
    id: DocumentId.describe(
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
export type Document = z.infer<typeof DocumentSchema>;

/** The working file of a document: the server mints the id of a new one; an update names it beside the file. */
export const DocumentContentSchema = DocumentSchema.omit({ id: true });
export type DocumentContent = z.infer<typeof DocumentContentSchema>;

/** The JSON form: what the store holds and what the wire carries. */
export type DocumentInput = z.input<typeof DocumentSchema>;
