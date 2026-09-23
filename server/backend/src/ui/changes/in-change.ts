import type { Context } from 'hono';
import { ChangeSlug } from '#backend/app/changes/change-slug';
import { ChangeNotFoundError } from '#backend/app/changes/changes.service';

/**
 * Runs `handler` for the change named by the `:change` route param, answering
 * `change_not_found` when the slug is malformed or the change does not exist.
 */
export async function inChange<T extends Response>(
  c: Context,
  handler: (slug: ChangeSlug) => Promise<T>,
) {
  const slug = ChangeSlug.tryCreate(c.req.param('change') ?? '');
  if (slug.isErr()) return c.json({ error: 'change_not_found' }, 404);
  try {
    return await handler(slug.value);
  } catch (error) {
    if (error instanceof ChangeNotFoundError) {
      return c.json({ error: 'change_not_found' }, 404);
    }
    throw error;
  }
}
