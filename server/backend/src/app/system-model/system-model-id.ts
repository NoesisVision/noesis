import { v7 as uuidv7 } from 'uuid';
import { z } from 'zod';

const systemModelIdSchema = z
  .string()
  .regex(
    /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    'Invalid SystemModelId',
  )
  .describe(
    "A system model's id: a lower-case UUIDv7 the server mints per scan, e.g. '01a0d22d-7f47-76b9-abd4-bd21d66a1d17'. It starts with the time it was minted, so ids sort by scan time. Names its file.",
  )
  .brand<'SystemModelId'>();

export const SystemModelId = Object.assign(systemModelIdSchema, {
  /** A new id, sorting after every one minted before it in this process. */
  mint: () => systemModelIdSchema.parse(uuidv7()),
});
export type SystemModelId = z.infer<typeof systemModelIdSchema>;
