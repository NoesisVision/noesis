import type { Context } from 'hono';
import { HTTPException } from 'hono/http-exception';
import type { ContentfulStatusCode } from 'hono/utils/http-status';
import type { DesignDocViolation } from '#backend/app/design-docs/design-doc';
import { InvalidDesignDocError } from '#backend/app/design-docs/invalid-design-doc-error';
import { NotFoundError } from '#backend/app/not-found-error';
import { serverLogger } from '#backend/platform/logging/server-logger';

const log = serverLogger('ui');

/** Every error answer of the surface, by the code the page has a sentence for. */
type ErrorBody =
  | { error: 'invalid_body'; issues?: unknown }
  | { error: 'change_not_found' | 'not_found' }
  | { error: 'payload_too_large'; limit: number }
  | { error: 'invalid_design_doc'; violations: DesignDocViolation[] }
  | { error: 'internal' };

const STATUS: Record<ErrorBody['error'], ContentfulStatusCode> = {
  invalid_body: 400,
  change_not_found: 404,
  not_found: 404,
  payload_too_large: 413,
  invalid_design_doc: 422,
  internal: 500,
};

/** Answers `body` with the status its code stands for. */
export function errorAnswer(c: Context, body: ErrorBody): Response {
  return c.json(body, STATUS[body.error]);
}

/**
 * Every route of the surface fails through here, so none of them catches: a
 * body that is not JSON answers 400, a missing or malformed entity 404, a
 * design document that breaks its rules 422, and anything unforeseen is
 * logged and answers 500.
 */
export function answerError(error: Error, c: Context): Response {
  if (error instanceof HTTPException) {
    // The body validator throws this for a body it cannot parse as JSON.
    return error.status === 400
      ? errorAnswer(c, { error: 'invalid_body' })
      : error.getResponse();
  }
  if (error instanceof NotFoundError) {
    return errorAnswer(c, {
      error: error.entity === 'change' ? 'change_not_found' : 'not_found',
    });
  }
  if (error instanceof InvalidDesignDocError) {
    return errorAnswer(c, {
      error: 'invalid_design_doc',
      violations: error.violations,
    });
  }
  log.error('{method} {path} failed unexpectedly: {error}', {
    method: c.req.method,
    path: c.req.path,
    error: String(error),
    stack: error.stack,
  });
  return errorAnswer(c, { error: 'internal' });
}
