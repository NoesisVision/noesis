import type { z } from 'zod';
import { mintable, uuidIdSchema } from '#backend/app/uuid-id';

export const DesignDocId = mintable(
  uuidIdSchema('design document').brand<'DesignDocId'>(),
);
export type DesignDocId = z.infer<typeof DesignDocId>;
