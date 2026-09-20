import { z } from 'zod';

// Never rewritten after import.

export const DocumentSchema = z
  .object({
    document_id: z
      .string()
      .describe(
        'The document id: a content hash of the source, so re-importing the same document yields the same id.',
      ),
    title: z.string().describe('The document title.'),
    date: z
      .string()
      .describe(
        'When the document was written or last revised, ISO 8601 date.',
      ),
    content: z.string().describe('The document text, verbatim.'),
  })
  .describe(
    'An imported document: the data.json of graph/changes/<change>/documents/<id>/.',
  );
export type Document = z.infer<typeof DocumentSchema>;
