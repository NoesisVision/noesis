import { z } from 'zod';
import { AnalyzedTopicSchema } from './conversation-analysis';
import { DocumentSchema } from './document';

export const DocumentAnalysisSchema = z
  .object({
    document: DocumentSchema,
    topics: z
      .array(AnalyzedTopicSchema)
      .describe(
        'Every topic the document contributes to, with the fragments that ground it.',
      ),
  })
  .describe(
    'The payload of a document import: the document itself plus its analysis into topics and decisions.',
  );
export type DocumentAnalysis = z.infer<typeof DocumentAnalysisSchema>;
