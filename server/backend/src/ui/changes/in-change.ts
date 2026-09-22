import type { Context } from 'hono';
import type { ChangeNotFound } from '#backend/app/changes/change-errors';
import { ChangeSlug } from '#backend/app/changes/change-slug';
import type { DesignDocNotFound } from '#backend/app/design-docs/design-doc-errors';
import type { DocumentNotFound } from '#backend/app/information-sources/document-errors';

export type NotFound = ChangeNotFound | DesignDocNotFound | DocumentNotFound;

/**
 * Runs `handler` for the change named by the `param` route param (`:change`
 * unless said otherwise), answering `change_not_found` when it is no slug.
 */
export function inChange<T>(
  c: Context,
  handler: (slug: ChangeSlug) => Promise<T>,
  param = 'change',
) {
  return ChangeSlug.tryCreate(c.req.param(param) ?? '').match(
    handler,
    async () => changeNotFound(c),
  );
}

/** Every kind answers 404; a missing change says so in its own code. */
export function notFound(c: Context, error: NotFound) {
  switch (error.kind) {
    case 'change-not-found':
      return changeNotFound(c);
    case 'design-doc-not-found':
    case 'document-not-found':
      return c.json({ error: 'not_found' }, 404);
  }
}

function changeNotFound(c: Context) {
  return c.json({ error: 'change_not_found' }, 404);
}
