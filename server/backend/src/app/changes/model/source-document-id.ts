import { v7 as uuidv7 } from 'uuid';
import { z } from 'zod';

const sourceDocumentIdSchema = z
  .uuid('Invalid SourceDocumentId')
  .describe(
    "A document's id: a UUID, e.g. '0199a1b2-7c3d-7e4f-8a5b-6c7d8e9f0a1b'. Minted by the server when the document is added, and never changed.",
  )
  .brand<'SourceDocumentId'>();

export const SourceDocumentId = Object.assign(sourceDocumentIdSchema, {
  generate: () => sourceDocumentIdSchema.parse(uuidv7()),
});
export type SourceDocumentId = z.infer<typeof sourceDocumentIdSchema>;
