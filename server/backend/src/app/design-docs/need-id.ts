import { z } from 'zod';

const MAX_LENGTH = 64;
const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

const needIdSchema = z
  .string()
  .max(MAX_LENGTH, `Invalid NeedId: at most ${MAX_LENGTH} characters`)
  .regex(SLUG, "Invalid NeedId: expected e.g. 'start-a-qdoc'")
  .describe(
    "A need's id: its name as lower-case kebab-case, e.g. 'start-a-qdoc'; unique within the design document, which writes it.",
  )
  .brand<'NeedId'>();
export const NeedId = needIdSchema;
export type NeedId = z.infer<typeof needIdSchema>;
