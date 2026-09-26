import type { z } from 'zod';
import { slugIdSchema } from '#backend/app/slug-id';

export const ChangeId = slugIdSchema('change').brand<'ChangeId'>();
export type ChangeId = z.infer<typeof ChangeId>;
