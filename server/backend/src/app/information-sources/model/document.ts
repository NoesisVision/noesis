import { z } from 'zod';

export const DocumentSchema = z
  .object({
    document_id: z
      .string()
      .describe(
        'The document id: the title as a slug, so it is unique within the change. The service derives it; retitling the document moves it to a new id.',
      ),
    title: z
      .string()
      .trim()
      .min(1)
      .describe(
        'The document title, unique within the change: it is what identifies the document, and the id is derived from it.',
      ),
    date: z.iso
      .date()
      .describe(
        'When the document was written or last revised, ISO 8601 date (YYYY-MM-DD): the document list sorts on it.',
      ),
    content: z
      .string()
      .describe('The document text, verbatim. Revised whenever it changes.'),
  })
  .describe(
    'A document of a change: the data.json of graph/changes/<change>/documents/<id>/.',
  );
export type Document = z.infer<typeof DocumentSchema>;

/**
 * Derived from the stored shape so the two can never drift: the service
 * derives `document_id` from the title, so a caller adding a document does
 * not supply one.
 */
export const CreateDocumentSchema = DocumentSchema.omit({
  document_id: true,
}).describe('The document to add to a change.');
export type CreateDocument = z.infer<typeof CreateDocumentSchema>;
