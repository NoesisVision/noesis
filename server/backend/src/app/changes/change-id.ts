import type { z } from 'zod';
import { datedIdSchema } from '#backend/app/ids/dated-id';

const changeIdSchema = datedIdSchema('change').brand<'ChangeId'>();
export const ChangeId = changeIdSchema;
export type ChangeId = z.infer<typeof changeIdSchema>;
