import { sValidator } from '@hono/standard-validator';
import { z } from 'zod';
import { ChangeId } from '#backend/app/changes/change-id';
import { DesignDocId } from '#backend/app/design-docs/design-doc-id';
import { DocumentId } from '#backend/app/information-sources/document-id';
import { type Entity, NotFoundError } from '#backend/app/not-found-error';

/** What each id names, so a malformed one is refused as that entity. */
const ENTITY_OF = new Map<z.core.$ZodType, Entity>([
  [ChangeId, 'change'],
  [DesignDocId, 'design document'],
  [DocumentId, 'document'],
]);

/**
 * Parses the route params into their value objects, read back with
 * `c.req.valid('param')`. A malformed id names nothing, so it is a
 * `NotFoundError` for the entity its schema stands for, answered where every
 * other one is. A malformed change id is the one named, as the handlers name
 * a missing change before what it holds.
 *
 * Give one call every param of the route, parent ones included: Hono keeps
 * only the last validated data of a target, so a second call would drop them.
 */
export function routeParams<T extends z.ZodRawShape>(shape: T) {
  return sValidator('param', z.object(shape), (result, c) => {
    if (result.success) return;
    const keys = result.error.flatMap(({ path }) => firstKey(path) ?? []);
    const key = keys.find((k) => shape[k] === ChangeId) ?? keys[0] ?? '';
    const schema = shape[key];
    const entity = schema === undefined ? undefined : ENTITY_OF.get(schema);
    throw new NotFoundError(entity ?? 'change', c.req.param(key) ?? '');
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
