import { expect, it } from 'bun:test';
import { createMemoryHistory } from '@tanstack/react-router';
import { getRouter } from '../src/router';
import { getContext } from '../src/shared/query/query-client';
import {
  DESIGN_DOCS_ROUTE_ID,
  DOCUMENTS_ROUTE_ID,
  OVERVIEW_ROUTE_ID,
} from '../src/shared/routing/route-ids';

/** What `useActiveRoute` reads as the leaf; loaders do not run for a match. */
function leafRouteId(url: string): string | undefined {
  const context = getContext();
  const router = getRouter(context);
  router.update({
    context,
    history: createMemoryHistory({ initialEntries: [url] }),
  });
  return router.matchRoutes(router.state.location).at(-1)?.routeId;
}

it('ends a list page on its view index route, not on the view itself', () => {
  expect(leafRouteId('/changes/test-2')).toBe(`${OVERVIEW_ROUTE_ID}/`);
  expect(leafRouteId('/changes/test-2/documents')).toBe(
    `${DOCUMENTS_ROUTE_ID}/`,
  );
  expect(leafRouteId('/changes/test-2/design-docs')).toBe(
    `${DESIGN_DOCS_ROUTE_ID}/`,
  );
});

it('ends a detail page on the detail route, so its view stops being the leaf', () => {
  expect(leafRouteId('/changes/test-2/documents/payment-retry-policy')).toBe(
    `${DOCUMENTS_ROUTE_ID}/$documentId`,
  );
  expect(leafRouteId('/changes/test-2/design-docs/01a0b349')).toBe(
    `${DESIGN_DOCS_ROUTE_ID}/$docId`,
  );
});
