import { v7 as uuidv7 } from 'uuid';
import type { z } from 'zod';
import { uuidIdSchema } from '#backend/app/uuid-id';

const designDocIdSchema =
  uuidIdSchema('design document').brand<'DesignDocId'>();

export const DesignDocId = Object.assign(designDocIdSchema, {
  generate: () => designDocIdSchema.parse(uuidv7()),
});
export type DesignDocId = z.infer<typeof designDocIdSchema>;
