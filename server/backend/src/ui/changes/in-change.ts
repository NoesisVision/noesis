import type { Context } from 'hono';
import { ChangeId } from '#backend/app/changes/change-id';
import { ChangeNotFoundError } from '#backend/app/changes/changes.service';

/**
 * Runs `handler` for the change named by the `:change` route param, answering
 * `change_not_found` when the id is malformed or the change does not exist.
 */
export async function inChange<T extends Response>(
  c: Context,
  handler: (change: ChangeId) => Promise<T>,
) {
  const change = ChangeId.safeParse(c.req.param('change') ?? '');
  if (!change.success) return c.json({ error: 'change_not_found' }, 404);
  try {
    return await handler(change.data);
  } catch (error) {
    if (error instanceof ChangeNotFoundError) {
      return c.json({ error: 'change_not_found' }, 404);
    }
    throw error;
  }
}
