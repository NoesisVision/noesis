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
      .describe(
        'The document title, unique within the change: it is what identifies the document.',
      ),
    date: z
      .string()
      .describe(
        'When the document was written or last revised, ISO 8601 date.',
      ),
    content: z
      .string()
      .describe('The document text, verbatim. Revised whenever it changes.'),
  })
  .describe(
    'A document of a change: the data.json of graph/changes/<change>/documents/<id>/.',
  );
export type Document = z.infer<typeof DocumentSchema>;
