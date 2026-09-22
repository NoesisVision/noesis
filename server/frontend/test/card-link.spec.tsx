import { expect, it } from 'bun:test';
import {
  createMemoryHistory,
  createRootRoute,
  createRouter,
  RouterProvider,
} from '@tanstack/react-router';
import type { ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MantineProvider } from '../src/shared/design-system/provider';
import { CardLink } from '../src/shared/ui/card-link';

/** A router of its own, so the link resolves without the app's route tree. */
async function render(component: () => ReactNode): Promise<string> {
  const router = createRouter({
    routeTree: createRootRoute({ component }),
    history: createMemoryHistory({ initialEntries: ['/'] }),
  }) as never as { load: () => Promise<void> };
  // Nothing renders out of a router that has not resolved its matches.
  await router.load();
  return renderToStaticMarkup(
    <MantineProvider>
      <RouterProvider router={router as never} />
    </MantineProvider>,
  );
}

const card = () => (
  <CardLink
    to="/changes/$changeId/documents/$documentId"
    params={{ changeId: 'test-2', documentId: 'payment-retry-policy' }}
    title="Payment retry policy"
    description="2026-09-14"
  />
);

it('is one link over the whole card, not a link inside one', async () => {
  const html = await render(card);
  expect(html).toContain(
    'href="/changes/test-2/documents/payment-retry-policy"',
  );
  // One anchor: a card holding its own link would be two tab stops.
  expect((html.match(/<a /g) ?? []).length).toBe(1);
  expect(html).toContain('mantine-Card-root');
});

it('titles the card an h3, under the h2 the view is headed with', async () => {
  expect(await render(card)).toMatch(/<h3[^>]*>Payment retry policy<\/h3>/);
});
