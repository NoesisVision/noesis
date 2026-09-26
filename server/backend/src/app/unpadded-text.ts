import { z } from 'zod';

/**
 * Text as a person wrote it, with nothing padded on: JSON Schema can state
 * this pattern, where it would drop a `.trim()` without a sound.
 */
const UNPADDED_TEXT = /^\S(?:[\s\S]*\S)?$/;

export function unpaddedText(): z.ZodString {
  return z
    .string()
    .regex(UNPADDED_TEXT, 'Starts and ends with a visible character');
}
