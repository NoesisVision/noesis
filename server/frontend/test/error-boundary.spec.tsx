import { afterAll, afterEach, expect, it, spyOn } from 'bun:test';
import { QueryClientProvider } from '@tanstack/react-query';
import { createMemoryHistory, RouterProvider } from '@tanstack/react-router';
import { renderToStaticMarkup } from 'react-dom/server';
import { getRouter } from '../src/router';
import { MantineProvider } from '../src/shared/design-system/provider';
import { getContext } from '../src/shared/query/query-client';

const fetchSpy = spyOn(globalThis, 'fetch');
afterEach(() => fetchSpy.mockReset());
afterAll(() => fetchSpy.mockRestore());

// The shell loads its own navigation, and it has to stay standing: only the
// view inside it is what failed.
const nav = {
  slug: 'test-2',
  name: 'Scheduling',
  key: 'NOE-1',
  type: 'feature',
  status: 'design',
  documents: [],
  designDocs: [],
};
const navigation = Response.json({ changes: [nav] });

const pathOf = (input: RequestInfo | URL): string =>
  typeof input === 'string'
    ? input
    : input instanceof URL
      ? input.href
      : input.url;

/** Everything but the change itself answers; the change is what goes wrong. */
function onlyNavigationAnswers(changeResponse: () => Response) {
  const answer = (input: RequestInfo | URL) =>
    Promise.resolve(
      pathOf(input).endsWith('/navigation')
        ? navigation.clone()
        : changeResponse(),
    );
  // react-dom augments `fetch` with `preconnect`; a stub only has to answer.
  fetchSpy.mockImplementation(answer as typeof fetch);
}

/** The page as the reader gets it, once the router has settled on `url`. */
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

it('draws a failed read as the status it failed with', async () => {
  onlyNavigationAnswers(
    () => new Response('Internal Server Error', { status: 500 }),
  );

  const html = await pageAt('/changes/test-2/documents');
  expect(html).toContain('500');
  expect(html).toMatch(/<h1[^>]*>The service failed<\/h1>/);
  expect(html).toContain('Try again');
  // The panel fills the view, not the page: the shell around it is untouched.
  expect(html).toContain('Scheduling');
  expect(html).toContain('role="alert"');
});

it('draws a change that is not there as a 404, not as a failure', async () => {
  onlyNavigationAnswers(() =>
    Response.json({ error: 'change_not_found' }, { status: 404 }),
  );

  const html = await pageAt('/changes/gone/documents');
  expect(html).toContain('404');
  expect(html).toMatch(/<h1[^>]*>Change not found<\/h1>/);
  expect(html).toContain('gone');
});

it('draws an address that matches no route at all', async () => {
  onlyNavigationAnswers(() => Response.json({ changes: [] }));

  const html = await pageAt('/nowhere');
  expect(html).toContain('404');
  expect(html).toMatch(/<h1[^>]*>Not found<\/h1>/);
  expect(html).toContain('Back');
});

it('does not blame the change for an address under it that is not a route', async () => {
  onlyNavigationAnswers(() => Response.json({ change: nav }));

  const html = await pageAt('/changes/test-2/nope');
  expect(html).toMatch(/<h1[^>]*>Not found<\/h1>/);
  expect(html).not.toContain('Change not found');
});

it('keeps a page that works when only a refetch behind it fails', () => {
  const { queries } = getContext().queryClient.getDefaultOptions();
  const throwOnError = queries?.throwOnError as (
    error: Error,
    query: { state: { data: unknown } },
  ) => boolean;

  expect(throwOnError(new Error('x'), { state: { data: undefined } })).toBe(
    true,
  );
  expect(throwOnError(new Error('x'), { state: { data: [] } })).toBe(false);
});
