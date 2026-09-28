import type { Context } from 'hono';
import { HTTPException } from 'hono/http-exception';
import type { ContentfulStatusCode } from 'hono/utils/http-status';
import { NotFoundError } from '#backend/app/not-found-error';
import { serverLogger } from '#backend/platform/logging/server-logger';

const log = serverLogger('ui');

/** Every error answer of the surface, by the code the page has a sentence for. */
type ErrorBody = { error: 'change_not_found' | 'not_found' | 'internal' };

const STATUS: Record<ErrorBody['error'], ContentfulStatusCode> = {
  change_not_found: 404,
  not_found: 404,
  internal: 500,
};

/**
 * Every route of the surface fails through here, so none of them catches: a
 * missing or malformed entity answers 404, and anything unforeseen is logged
 * and answers 500.
 */
export function answerError(error: Error, c: Context): Response {
  if (error instanceof HTTPException) return error.getResponse();
  if (error instanceof NotFoundError) {
    return answer(c, {
      error: error.entity === 'change' ? 'change_not_found' : 'not_found',
    });
  }
  log.error('{method} {path} failed unexpectedly: {error}', {
    method: c.req.method,
    path: c.req.path,
    error: String(error),
    stack: error.stack,
  });
  return answer(c, { error: 'internal' });
}

function answer(c: Context, body: ErrorBody): Response {
  return c.json(body, STATUS[body.error]);
}
