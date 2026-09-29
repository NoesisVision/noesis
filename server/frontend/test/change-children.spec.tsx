import { afterAll, afterEach, beforeAll, expect, it, spyOn } from 'bun:test';
import { QueryClientProvider } from '@tanstack/react-query';
import { createMemoryHistory, RouterProvider } from '@tanstack/react-router';
import { renderToStaticMarkup } from 'react-dom/server';
import { getRouter } from '../src/router';
import { MantineProvider } from '../src/shared/design-system/provider';
import { getContext } from '../src/shared/query/query-client';

// The views that list what a change holds read it from the change itself:
// no route lists one kind alone any more.

const CHANGE = '2026-01-01-scheduling';

const change = {
  id: CHANGE,
  name: 'Scheduling',
  key: '',
  type: 'feature',
  status: 'design',
  description: '',
};

const fetchSpy = spyOn(globalThis, 'fetch');
const requested: string[] = [];

beforeAll(() => {
  fetchSpy.mockImplementation(((input: RequestInfo | URL) => {
    const url =
      typeof input === 'string'
        ? input
        : input instanceof URL
          ? input.href
          : input.url;
    requested.push(url);
    if (url.endsWith('/ui/changes')) {
      return Promise.resolve(
        Response.json({ changes: [{ ...change, entries: [] }] }),
      );
    }
    return Promise.resolve(
      Response.json({
        change: {
          ...change,
          designDocs: [
            { id: '2026-01-02-refunds', name: 'Refunds', implemented: true },
          ],
          documents: [
            {
              id: '2026-01-01-notes',
              title: 'Meeting notes',
              date: '2026-01-01',
            },
          ],
        },
      }),
    );
  }) as typeof fetch);
});
afterEach(() => {
  fetchSpy.mockClear();
  requested.length = 0;
});
afterAll(() => fetchSpy.mockRestore());

async function pageAt(url: string): Promise<string> {
  const context = getContext();
  const router = getRouter(context);
  router.update({
    context,
    history: createMemoryHistory({ initialEntries: [url] }),
  });
  await router.load();
  return renderToStaticMarkup(
    <MantineProvider>
      <QueryClientProvider client={context.queryClient}>
        <RouterProvider router={router} />
      </QueryClientProvider>
    </MantineProvider>,
  );
}

it('lists the documents the change holds', async () => {
  const html = await pageAt(`/changes/${CHANGE}/documents`);

  expect(html).toContain('Meeting notes');
  expect(requested.some((url) => url.endsWith('/documents'))).toBe(false);
});

it('lists the design documents the change holds', async () => {
  const html = await pageAt(`/changes/${CHANGE}/design-docs`);

  expect(html).toContain('Refunds');
  expect(html).toContain('Implemented');
  expect(requested.some((url) => url.endsWith('/design-docs'))).toBe(false);
});

it('counts and lists both kinds on the overview', async () => {
  const html = await pageAt(`/changes/${CHANGE}`);

  expect(html).toContain('Meeting notes');
  expect(html).toContain('Refunds');
});
