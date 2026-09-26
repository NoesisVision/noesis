import { v7 as uuidv7 } from 'uuid';
import type { z } from 'zod';
import { uuidIdSchema } from '#backend/app/uuid-id';

const sourceDocumentIdSchema =
  uuidIdSchema('document').brand<'SourceDocumentId'>();

export const SourceDocumentId = Object.assign(sourceDocumentIdSchema, {
  generate: () => sourceDocumentIdSchema.parse(uuidv7()),
});
export type SourceDocumentId = z.infer<typeof sourceDocumentIdSchema>;
