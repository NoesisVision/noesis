import type { z } from 'zod';
import { slugIdSchema } from '#backend/app/slug-id.ts';

const designDocIdSchema =
  slugIdSchema('design document').brand<'DesignDocId'>();
export const DesignDocId = designDocIdSchema;
export type DesignDocId = z.infer<typeof designDocIdSchema>;
