// Copied from packages/shared-contracts/src/information-sources/document-analysis.ts by @noesis-vision/noesis 0.1.0-beta.4. Do not edit: run `bun run generate`.

import { z } from 'zod';
import { AnalyzedTopicSchema } from './conversation-analysis.js';
import { DocumentSchema } from './document.js';

/*
 * The payload of a document import: the document split into fragments and
 * sections, plus the same topic analysis a conversation import carries. The
 * service validates it, writes the document file, and creates or updates the
 * wiki topics and decisions it names.
 */

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
