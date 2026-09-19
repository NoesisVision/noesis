import { z } from 'zod';

// Lets an import, a re-analysis or a rename rewrite a file without undoing a
// person's hand edits.

export const Locked = z
  .boolean()
  .default(false)
  .describe(
    'True when a person edited the field this marker is named after (`<field>_locked` guards `<field>`). Preserve the field as it is and ask before changing it.',
  );
export type Locked = z.infer<typeof Locked>;
