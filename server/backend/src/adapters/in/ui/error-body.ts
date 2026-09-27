import type { Context } from 'hono';
import { HTTPException } from 'hono/http-exception';
import type { ContentfulStatusCode } from 'hono/utils/http-status';
import { z } from 'zod';
import { ConcurrentModificationError } from '#backend/app/changes/concurrent-modification-error';
import { ChangeId } from '#backend/app/changes/model/change-id';
import type { DesignDocViolation } from '#backend/app/changes/model/design-doc';
import { InvalidDesignDocError } from '#backend/app/changes/model/invalid-design-doc-error';
import {
  type Entity,
  NotFoundError,
} from '#backend/app/changes/model/not-found-error';
import { serverLogger } from '#backend/platform/logging/server-logger';

const log = serverLogger('ui');

const NotFoundFields = {
  entity: z.enum([
    'change',
    'source document',
    'design document',
  ]) satisfies z.ZodType<Entity>,
  id: z.string(),
  change: ChangeId.optional(),
};

const Violation = z.object({
  path: z.string(),
  reason: z.enum([
    'changedInGreenField',
    'unknownElement',
    'unchangedFieldInAddedItem',
    'humanAuthor',
  ]),
}) satisfies z.ZodType<DesignDocViolation>;

/**
 * Every error answer of the surface, keyed by the code the page has a
 * sentence for. It carries what the domain error held, so a caller over HTTP
 * rebuilds the very error the handler threw.
 */
export const ErrorBody = z.discriminatedUnion('error', [
  z.object({
    error: z.literal('invalid_body'),
    issues: z.unknown().optional(),
  }),
  z.object({ error: z.literal('change_not_found'), ...NotFoundFields }),
  z.object({ error: z.literal('not_found'), ...NotFoundFields }),
  z.object({ error: z.literal('conflict'), change: ChangeId }),
  z.object({ error: z.literal('payload_too_large'), limit: z.int() }),
  z.object({
    error: z.literal('invalid_design_doc'),
    violations: z.array(Violation),
  }),
  z.object({ error: z.literal('shutting_down') }),
  z.object({ error: z.literal('internal') }),
]);
export type ErrorBody = z.infer<typeof ErrorBody>;

const STATUS: Record<ErrorBody['error'], ContentfulStatusCode> = {
  invalid_body: 400,
  change_not_found: 404,
  not_found: 404,
  conflict: 409,
  payload_too_large: 413,
  invalid_design_doc: 422,
  shutting_down: 503,
  internal: 500,
};

/** Answers `body` with the status its code stands for. */
export function errorAnswer(c: Context, body: ErrorBody): Response {
  return c.json(body, STATUS[body.error]);
}

/**
 * Every route of the surface fails through here, so none of them catches: a
 * missing or malformed entity answers 404, a write that lost a race 409, a
 * design document that breaks its rules 422 and a body that is not JSON 400,
 * and anything unforeseen is logged and answers 500.
 */
export function answerError(error: Error, c: Context): Response {
  // The validator throws before its hook sees a body it cannot parse.
  if (error instanceof HTTPException) {
    return error.status === 400
      ? errorAnswer(c, { error: 'invalid_body' })
      : error.getResponse();
  }
  const body = encode(error);
  if (body !== null) return errorAnswer(c, body);
  log.error('{method} {path} failed unexpectedly: {error}', {
    method: c.req.method,
    path: c.req.path,
    error: String(error),
    stack: error.stack,
  });
  return errorAnswer(c, { error: 'internal' });
}

/**
 * The error an error answer stands for: the domain error it was encoded
 * from, or a plain one saying what the service answered.
 */
export function decodeError(status: number, json: unknown): Error {
  const parsed = ErrorBody.safeParse(json);
  if (!parsed.success) {
    return new Error(
      `The service answered ${status} with a body that is not an error it knows.`,
    );
  }
  const body = parsed.data;
  switch (body.error) {
    case 'change_not_found':
    case 'not_found':
      return new NotFoundError(body.entity, body.id, body.change);
    case 'conflict':
      return new ConcurrentModificationError(body.change);
    case 'invalid_design_doc':
      return new InvalidDesignDocError(body.violations);
    case 'invalid_body':
      return new Error(
        `The service refused the request body: ${JSON.stringify(body.issues ?? [])}`,
      );
    case 'payload_too_large':
      return new Error(
        `The request body is over the service's limit of ${body.limit} bytes.`,
      );
    case 'shutting_down':
      return new Error('The service is shutting down.');
    case 'internal':
      return new Error(
        'The service failed unexpectedly; its log under .noesis/logs/ says why.',
      );
  }
}

function encode(error: Error): ErrorBody | null {
  if (error instanceof NotFoundError) {
    return {
      error: error.entity === 'change' ? 'change_not_found' : 'not_found',
      entity: error.entity,
      id: error.id,
      change: error.change,
    };
  }
  if (error instanceof ConcurrentModificationError) {
    return { error: 'conflict', change: error.change };
  }
  if (error instanceof InvalidDesignDocError) {
    return { error: 'invalid_design_doc', violations: error.violations };
  }
  return null;
}
