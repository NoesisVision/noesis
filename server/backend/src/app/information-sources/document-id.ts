import type { z } from 'zod';
import { slugIdSchema } from '#backend/app/slug-id.ts';

const documentIdSchema = slugIdSchema('document').brand<'DocumentId'>();
export const DocumentId = documentIdSchema;
export type DocumentId = z.infer<typeof documentIdSchema>;
