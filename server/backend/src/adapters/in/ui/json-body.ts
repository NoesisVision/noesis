import { flattenErrors, sValidator } from '@hono/standard-validator';
import { bodyLimit } from 'hono/body-limit';
import type { z } from 'zod';
import { MAX_WORKING_FILE_BYTES } from '#backend/platform/files/working-file-limit';
import { errorAnswer } from './error-body';

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

/**
 * Refuses a body larger than a working file may be, before it is read whole.
 * `/ui` answers any local caller, not only the shim that sends working files.
 */
export const workingFileLimit = bodyLimit({
  maxSize: MAX_WORKING_FILE_BYTES,
  onError: (c) =>
    errorAnswer(c, {
      error: 'payload_too_large',
      limit: MAX_WORKING_FILE_BYTES,
    }),
});
