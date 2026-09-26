import { z } from 'zod';

/**
 * The schema of an id the server mints as a UUID when it adds an entity, and
 * never changes. Brand it where it is used.
 */
export function uuidIdSchema(subject: string) {
  return z
    .uuid(`Invalid ${subject} id`)
    .describe(
      `A ${subject}'s id: a UUID, e.g. '0199a1b2-7c3d-7e4f-8a5b-6c7d8e9f0a1b'. Minted by the server when the ${subject} is added, and never changed.`,
    );
}
