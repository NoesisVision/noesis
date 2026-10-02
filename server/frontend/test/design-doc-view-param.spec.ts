import { describe, expect, it } from 'bun:test';
import { createMemoryHistory } from '@tanstack/react-router';
import { getRouter } from '../src/router';
import { getContext } from '../src/shared/query/query-client';

const DOC =
  '/changes/2026-01-01-refunds/design-docs/2026-01-01-partial-refunds';

/** A router on one address; loaders do not run for a match. */
function routerAt(url: string) {
  const context = getContext();
  const router = getRouter(context);
  router.update({
    context,
    history: createMemoryHistory({ initialEntries: [url] }),
  });
  return router;
}

type AppRouter = ReturnType<typeof routerAt>;

/** The search the design document's route reads off the address it is at. */
const searchOf = (router: AppRouter) =>
  router.matchRoutes(router.parseLocation(router.history.location)).at(-1)
    ?.search;

describe('the view of a design document', () => {
  it('is named by the address', () => {
    expect(searchOf(routerAt(`${DOC}?view=requirements`))).toMatchObject({
      view: 'requirements',
    });
  });

  it('is the model when the address names none, or one it does not know', () => {
    expect(searchOf(routerAt(DOC))?.view).toBeUndefined();
    expect(searchOf(routerAt(`${DOC}?view=nonsense`))?.view).toBeUndefined();
  });

  it('keeps the place in the requirements apart from the place in the model', () => {
    const search = searchOf(
      routerAt(
        `${DOC}?view=requirements&node=building_block%7Csales.refunds.Refund&entry=need%3Arefund-single-lines&entryQ=refund`,
      ),
    );
    expect(search).toMatchObject({
      node: 'building_block|sales.refunds.Refund',
      entry: 'need:refund-single-lines',
      entryQ: 'refund',
    });
    expect(search?.q).toBeUndefined();
  });

  it('is returned to by Back from the element a requirement links to', () => {
    const router = routerAt(`${DOC}?view=requirements`);
    // Where a requirement's element link goes: the model, the element in hand.
    const { href } = router.buildLocation({
      to: '/changes/$changeId/design-docs/$docId',
      params: {
        changeId: '2026-01-01-refunds',
        docId: '2026-01-01-partial-refunds',
      },
      search: { node: 'building_block|sales.refunds.Refund' },
    });
    router.history.push(href);
    expect(searchOf(router)).toMatchObject({
      node: 'building_block|sales.refunds.Refund',
    });
    expect(searchOf(router)?.view).toBeUndefined();

    router.history.back();
    expect(searchOf(router)).toMatchObject({ view: 'requirements' });
  });
});
