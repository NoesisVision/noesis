import { sValidator } from '@hono/standard-validator';
import { z } from 'zod';
import { ChangeId } from '#backend/app/changes/model/change-id';
import { DesignDocId } from '#backend/app/changes/model/design-doc-id';
import {
  type Entity,
  NotFoundError,
} from '#backend/app/changes/model/not-found-error';
import { SourceDocumentId } from '#backend/app/changes/model/source-document-id';

/** What each id names, so a malformed one is refused as that entity. */
const ENTITY_OF = new Map<z.core.$ZodType, Entity>([
  [ChangeId, 'change'],
  [DesignDocId, 'design document'],
  [SourceDocumentId, 'source document'],
]);

/**
 * Parses the route params into their value objects, read back with
 * `c.req.valid('param')`. A malformed id names nothing, so it is a
 * `NotFoundError` for the entity its schema stands for, answered where every
 * other one is.
 *
 * Give one call every param of the route, parent ones included: Hono keeps
 * only the last validated data of a target, so a second call would drop them.
 */
export function routeParams<T extends z.ZodRawShape>(shape: T) {
  return sValidator('param', z.object(shape), (result, c) => {
    if (result.success) return;
    const key = firstKey(result.error[0]?.path);
    const schema = key === undefined ? undefined : shape[key];
    const entity = schema === undefined ? undefined : ENTITY_OF.get(schema);
    throw new NotFoundError(entity ?? 'change', c.req.param(key ?? '') ?? '');
  });
}

/** A Standard Schema path segment is a key, or an object that holds one. */
function firstKey(
  path: ReadonlyArray<PropertyKey | { key: PropertyKey }> | undefined,
): string | undefined {
  const [first] = path ?? [];
  const key = typeof first === 'object' ? first.key : first;
  return typeof key === 'string' ? key : undefined;
}
