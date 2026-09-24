import type { z } from 'zod';
import { datedIdSchema } from '#backend/app/ids/dated-id';

const designDocIdSchema =
  datedIdSchema('design document').brand<'DesignDocId'>();
export const DesignDocId = designDocIdSchema;
export type DesignDocId = z.infer<typeof designDocIdSchema>;
