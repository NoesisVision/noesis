import type { z } from 'zod';
import { mintable, uuidIdSchema } from '#backend/app/uuid-id';

export const SourceDocumentId = mintable(
  uuidIdSchema('source document').brand<'SourceDocumentId'>(),
);
export type SourceDocumentId = z.infer<typeof SourceDocumentId>;
