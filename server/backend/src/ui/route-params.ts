import { sValidator } from '@hono/standard-validator';
import { z } from 'zod';

/**
 * Parses the route params into their value objects, read back with
 * `c.req.valid('param')`. A malformed id names nothing, so it answers 404: a
 * bad `:change` with `change_not_found`, any other with `not_found`.
 *
 * Give one call every param of the route, parent ones included: Hono keeps
 * only the last validated data of a target, so a second call would drop them.
 */
export function routeParams<T extends z.ZodRawShape>(shape: T) {
  return sValidator('param', z.object(shape), (result, c) => {
    if (result.success) return;
    // A Standard Schema path segment is a key, or an object that holds one.
    const badChange = result.error.some(
      ({ path: [first] = [] }) =>
        (typeof first === 'object' ? first.key : first) === 'change',
    );
    return c.json({ error: badChange ? 'change_not_found' : 'not_found' }, 404);
  });
}
