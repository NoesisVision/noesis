import { sValidator } from '@hono/standard-validator';
import { z } from 'zod';
import { ChangeId } from '#backend/app/changes/change-id';

/**
 * Parses the route params into their value objects, read back with
 * `c.req.valid('param')`. A malformed id names nothing, so it answers 404: a
 * bad change id with `change_not_found`, any other with `not_found`. The
 * schema tells them apart, not the param's name.
 *
 * Give one call every param of the route, parent ones included: Hono keeps
 * only the last validated data of a target, so a second call would drop them.
 */
export function routeParams<T extends z.ZodRawShape>(shape: T) {
  return sValidator('param', z.object(shape), (result, c) => {
    if (result.success) return;
    const badChange = result.error.some(({ path: [first] = [] }) => {
      // A Standard Schema path segment is a key, or an object that holds one.
      const key = typeof first === 'object' ? first.key : first;
      return typeof key === 'string' && shape[key] === ChangeId;
    });
    return c.json({ error: badChange ? 'change_not_found' : 'not_found' }, 404);
  });
}
