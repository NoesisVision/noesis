import { flattenErrors, sValidator } from '@hono/standard-validator';
import type { z } from 'zod';

/**
 * Parses the JSON body with `schema`, read back with `c.req.valid('json')`. A
 * body that does not fit is the caller's mistake, so it answers 400 with the
 * issues to fix.
 */
export function jsonBody<T extends z.ZodType>(schema: T) {
  return sValidator('json', schema, (result, c) => {
    if (result.success) return;
    return c.json(
      { error: 'invalid_body', issues: flattenErrors(result.error) },
      400,
    );
  });
}
