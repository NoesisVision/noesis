import { describe, expect, it } from 'bun:test';
import { createMemoryHistory } from '@tanstack/react-router';
import { readingView } from '../src/features/design-docs/design-docs.model';
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

  it('is the overview when the address names none, or one it does not know', () => {
    expect(readingView(searchOf(routerAt(DOC)) ?? {})).toBe('overview');
    expect(readingView(searchOf(routerAt(`${DOC}?view=nonsense`)) ?? {})).toBe(
      'overview',
    );
  });

  it('is the model when the address names an element and no view, as every element link did', () => {
    expect(
      readingView(
        searchOf(
          routerAt(`${DOC}?node=building_block%7Csales.refunds.Refund`),
        ) ?? {},
      ),
    ).toBe('model');
  });

  it('is the view the address names, an element in hand or not', () => {
    for (const view of ['overview', 'model'] as const)
      expect(
        readingView(
          searchOf(
            routerAt(
              `${DOC}?view=${view}&node=building_block%7Csales.refunds.Refund`,
            ),
          ) ?? {},
        ),
      ).toBe(view);
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

  it('is the architecture when the address says so, keeping a place of its own', () => {
    const search = searchOf(
      routerAt(
        `${DOC}?view=architecture&node=building_block%7Csales.refunds.Refund&arch=checks%2Fcheck%3Acaller-unknown&archQ=port`,
      ),
    );
    expect(search).toMatchObject({
      view: 'architecture',
      node: 'building_block|sales.refunds.Refund',
      arch: 'checks/check:caller-unknown',
      archQ: 'port',
    });
    expect(search?.entry).toBeUndefined();
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
    expect(readingView(searchOf(router) ?? {})).toBe('model');

    router.history.back();
    expect(searchOf(router)).toMatchObject({ view: 'requirements' });
  });
});
