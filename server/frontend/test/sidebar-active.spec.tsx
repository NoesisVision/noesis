import {
  afterAll,
  afterEach,
  beforeAll,
  describe,
  expect,
  it,
  spyOn,
} from 'bun:test';
import { QueryClientProvider } from '@tanstack/react-query';
import { createMemoryHistory, RouterProvider } from '@tanstack/react-router';
import { renderToStaticMarkup } from 'react-dom/server';
import { getRouter } from '../src/router';
import { MantineProvider } from '../src/shared/design-system/provider';
import { getContext } from '../src/shared/query/query-client';

/*
 * Exactly one link in the sidebar says it is the one you are on, and it is
 * the right one. Asserted through the whole router, because what decides it
 * is the link's own match against the address — there is nothing to unit
 * test, and the two times this broke it broke in the wiring.
 */

const CHANGE = {
  slug: 'test-2',
  name: 'Scheduling',
  key: 'NOE-1',
  type: 'feature',
  status: 'design',
  documents: [{ id: 'notes', name: 'Notes' }],
  designDocs: [{ id: 'doc-a', name: 'Doc A' }],
};

const EMPTY_DESIGN_DOC = {
  id: 'doc-a',
  name: { value: 'Doc A' },
  description: { value: '' },
  modules: { added: [], removed: [], modified: [] },
  buildingBlocks: { added: [], removed: [], modified: [] },
  behaviours: { added: [], removed: [], modified: [] },
  implemented: false,
};

const fetchSpy = spyOn(globalThis, 'fetch');

beforeAll(() => {
  fetchSpy.mockImplementation(((input: RequestInfo | URL) => {
    const url =
      typeof input === 'string'
        ? input
        : input instanceof URL
          ? input.href
          : input.url;
    if (url.endsWith('/navigation')) {
      return Promise.resolve(Response.json({ changes: [CHANGE] }));
    }
    if (url.includes('/design-docs/')) {
      return Promise.resolve(
        Response.json({
          summary: {
            id: 'doc-a',
            name: 'Doc A',
            implemented: false,
            path: '/x',
          },
          document: EMPTY_DESIGN_DOC,
          outline: [],
        }),
      );
    }
    if (url.includes('/documents/')) {
      return Promise.resolve(
        Response.json({
          summary: {
            id: 'notes',
            title: 'Notes',
            date: '2026-01-01',
            path: '/x',
          },
          document: {
            document_id: 'notes',
            title: 'Notes',
            date: '2026-01-01',
            content: 'Notes.',
          },
        }),
      );
    }
    if (url.endsWith('/design-docs')) {
      return Promise.resolve(Response.json({ designDocs: CHANGE.designDocs }));
    }
    if (url.endsWith('/documents')) {
      return Promise.resolve(Response.json({ documents: CHANGE.documents }));
    }
    return Promise.resolve(Response.json({ change: CHANGE }));
  }) as typeof fetch);
});

afterEach(() => fetchSpy.mockClear());
afterAll(() => fetchSpy.mockRestore());

/** The links the sidebar marks as the one you are on, at `url`. */
async function currentLinks(url: string): Promise<(string | undefined)[]> {
  const context = getContext();
  const router = getRouter(context);
  router.update({
    context,
    history: createMemoryHistory({ initialEntries: [url] }),
  });
  await router.load();
  const html = renderToStaticMarkup(
    <MantineProvider>
      <QueryClientProvider client={context.queryClient}>
        <RouterProvider router={router} />
      </QueryClientProvider>
    </MantineProvider>,
  );
  return [...html.matchAll(/<a [^>]*>/g)]
    .filter((tag) => /aria-current="page"|data-active="true"/.test(tag[0]))
    .map((tag) => /href="([^"]*)"/.exec(tag[0])?.[1]);
}

describe('the sidebar', () => {
  it.each([
    ['/changes/test-2', '/changes/test-2'],
    ['/changes/test-2/documents', '/changes/test-2/documents'],
    ['/changes/test-2/documents/notes', '/changes/test-2/documents/notes'],
    ['/changes/test-2/design-docs', '/changes/test-2/design-docs'],
    ['/changes/test-2/design-docs/doc-a', '/changes/test-2/design-docs/doc-a'],
    ['/system-model', '/system-model'],
  ])('marks one link at %s', async (url, expected) => {
    expect(await currentLinks(url)).toEqual([expected]);
  });

  it('leaves a heading to its item once the item is open', async () => {
    // The heading's icon carries "one of these is open" instead; the CSS
    // reads the item's `aria-current` for it.
    expect(
      await currentLinks('/changes/test-2/design-docs/doc-a'),
    ).not.toContain('/changes/test-2/design-docs');
  });

  it('stays on the document while the reader moves about inside it', async () => {
    // A design document keeps the element in hand and the search in the
    // address. A link names a view, never a reading position inside one, so
    // the search takes no part in deciding which link is current.
    expect(
      await currentLinks(
        '/changes/test-2/design-docs/doc-a?node=module%7Cx&q=slot',
      ),
    ).toEqual(['/changes/test-2/design-docs/doc-a']);
  });
});
