import { z } from 'zod';

/*
 * The locked-field marker.
 *
 * A field a person edited is flagged as locked in the file itself, by a
 * sibling boolean named `<field>_locked`. Skills preserve a locked field
 * instead of overwriting it, and ask before changing one. The marker is what
 * lets an import, a re-analysis or a rename run over a file without undoing
 * work a person did by hand.
 */

export const Locked = z
  .boolean()
  .default(false)
  .describe(
    'True when a person edited the field this marker is named after (`<field>_locked` guards `<field>`). Preserve the field as it is and ask before changing it.',
  );
export type Locked = z.infer<typeof Locked>;
