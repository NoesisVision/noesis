import type { z } from 'zod';
import { slugIdSchema } from './slug-id';

export const ChangeId = slugIdSchema('change').brand<'ChangeId'>();
export type ChangeId = z.infer<typeof ChangeId>;
