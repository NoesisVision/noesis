import type { z } from 'zod';
import { slugIdSchema } from '#backend/app/slug-id.ts';

const sourceDocumentIdSchema =
  slugIdSchema('document').brand<'SourceDocumentId'>();
export const SourceDocumentId = sourceDocumentIdSchema;
export type SourceDocumentId = z.infer<typeof sourceDocumentIdSchema>;
