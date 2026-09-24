import { z } from 'zod';
import { DocumentId } from './document-id';

export const DocumentSchema = z
  .object({
    id: DocumentId.describe(
      "The document id: its creation date, then its title as lower-case kebab-case, e.g. '2026-09-24-payment-retry'; unique within the change. Minted once by the writer with the plugin's entity-id.ts script and never changed, so it keeps the original title; saving at an existing id updates that document.",
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
    'A document of a change: the working file an agent writes, and the data.json of graph/changes/<change>/documents/<id>/.',
  );
export type Document = z.infer<typeof DocumentSchema>;

/** The JSON form: what the store holds and what the wire carries. */
export type DocumentInput = z.input<typeof DocumentSchema>;
