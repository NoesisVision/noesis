import type { z } from 'zod';
import { datedIdSchema } from '#backend/app/ids/dated-id';

const documentIdSchema = datedIdSchema('document').brand<'DocumentId'>();
export const DocumentId = documentIdSchema;
export type DocumentId = z.infer<typeof documentIdSchema>;
