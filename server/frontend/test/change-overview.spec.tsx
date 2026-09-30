import { afterAll, afterEach, describe, expect, it, spyOn } from 'bun:test';
import { QueryClientProvider } from '@tanstack/react-query';
import { createMemoryHistory, RouterProvider } from '@tanstack/react-router';
import { renderToStaticMarkup } from 'react-dom/server';
import { getRouter } from '../src/router';
import { MantineProvider } from '../src/shared/design-system/provider';
import { getContext } from '../src/shared/query/query-client';

const fetchSpy = spyOn(globalThis, 'fetch');
afterEach(() => fetchSpy.mockReset());
afterAll(() => fetchSpy.mockRestore());

const change = {
  id: '2026-01-01-scheduling',
  name: 'Scheduling',
  key: 'NOE-1',
  type: 'feature',
  status: 'design',
};

const pathOf = (input: RequestInfo | URL): string =>
  typeof input === 'string'
    ? input
    : input instanceof URL
      ? input.href
      : input.url;

/** The shell's navigation and the change the layout loads; the lists wait. */
function answering(description: string) {
  const answer = (input: RequestInfo | URL) => {
    const path = pathOf(input);
    if (path.endsWith('/navigation'))
      return Promise.resolve(
        Response.json({ changes: [{ ...change, entries: [] }] }),
      );
    if (path.endsWith(`/changes/${change.id}`))
      return Promise.resolve(
        Response.json({ change: { ...change, description } }),
      );
    return new Promise<Response>(() => {});
  };
  // react-dom augments `fetch` with `preconnect`; a stub only has to answer.
  fetchSpy.mockImplementation(answer as typeof fetch);
}

async function overview(description: string): Promise<string> {
  answering(description);
  const context = getContext();
  const router = getRouter(context);
  router.update({
    context,
    history: createMemoryHistory({ initialEntries: [`/changes/${change.id}`] }),
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

describe('change overview', () => {
  /*
   * The description is read in the Markdown editor, which arrives on its own
   * rather than with the bundle. `lazy` resolves once for the whole process,
   * so a render shows either the editor's fallback or the text itself,
   * depending on whether anything earlier in the run already opened it.
   */
  const OPENING = 'Opening the editor…';

  it('opens with what the change is about', async () => {
    const html = await overview('Book rooms without double-booking them.');
    expect(
      html.includes(OPENING) ||
        html.includes('Book rooms without double-booking them.'),
    ).toBe(true);
  });

  it('leaves the space out when the change says nothing about itself', async () => {
    const html = await overview('');
    expect(html).toContain('Documents');
    expect(html).not.toContain(OPENING);
  });
});
