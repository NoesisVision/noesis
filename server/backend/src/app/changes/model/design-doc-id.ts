import { v7 as uuidv7 } from 'uuid';
import { z } from 'zod';

const designDocIdSchema = z
  .uuid('Invalid DesignDocId')
  .describe(
    "A design document's id: a UUID, e.g. '0199a1b2-7c3d-7e4f-8a5b-6c7d8e9f0a1b'. Minted by the server when the design document is added, and never changed.",
  )
  .brand<'DesignDocId'>();

export const DesignDocId = Object.assign(designDocIdSchema, {
  generate: () => designDocIdSchema.parse(uuidv7()),
});
export type DesignDocId = z.infer<typeof designDocIdSchema>;
