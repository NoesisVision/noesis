import type { z } from 'zod';
import { slugIdSchema } from '#backend/app/slug-id.ts';

const changeIdSchema = slugIdSchema('change').brand<'ChangeId'>();
export const ChangeId = changeIdSchema;
export type ChangeId = z.infer<typeof changeIdSchema>;
