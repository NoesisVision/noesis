import { afterEach, describe, expect, it } from 'bun:test';
import { renderToStaticMarkup } from 'react-dom/server';
import { DesignDocWorkbench } from '../src/features/design-docs/ui/design-doc-workbench';
import { MantineProvider } from '../src/shared/design-system/provider';
import { designDocDetailFixture } from './fixtures/design-doc.fixture';

const reading = (node: string | null, query = '') =>
  renderToStaticMarkup(
    <MantineProvider>
      <DesignDocWorkbench
        detail={designDocDetailFixture}
        node={node}
        query={query}
        onSelect={() => {}}
        onQuery={() => {}}
      />
    </MantineProvider>,
  );

const page = reading(null);

const headings = [...page.matchAll(/<h([1-6])[^>]*>(.*?)<\/h\1>/g)].map(
  ([, level, text]) => [Number(level), text] as const,
);

describe('DesignDocWorkbench', () => {
  it('heads the page with the document, once', () => {
    const first = headings.filter(([level]) => level === 1);
    expect(first).toHaveLength(1);
    expect(first[0]?.[1]).toContain('Partial refunds');
  });

  it('heads the panel with the element in hand, a level down', () => {
    expect(headings[1]).toEqual([2, 'sales']);
  });

  it('never skips a heading level on the way down', () => {
    for (const [index, [level]] of headings.entries()) {
      const previous = headings[index - 1]?.[0] ?? 0;
      expect(level).toBeLessThanOrEqual(previous + 1);
    }
  });

  it('names every control that is only a glyph', () => {
    expect(page).toContain('aria-label="Search the outline"');
    expect(page).toContain('aria-label="Expand everything"');
    expect(page).toContain('aria-label="Collapse everything"');
    expect(page).toContain('aria-label="Full screen"');
  });

  it('opens on the model the document describes', () => {
    expect(page.match(/role="treeitem"/g)).toHaveLength(3);
    expect(page).toContain('>Refund<');
    expect(page).toContain('aggregate');
  });

  it('lets the two columns be resized, by keyboard as well as by hand', () => {
    const handle = /<[^<>]*role="separator"[^>]*>/.exec(page)?.[0] ?? '';
    expect(handle).toContain('tabindex="0"');
    // Mantine gives the handle no name of its own, and a separator a reader
    // can take with the keyboard needs one.
    expect(handle).toContain('aria-label="Resize the columns"');
  });

  it('says nothing is being searched until something is', () => {
    expect(page).not.toContain('<output');
    expect(page).not.toContain('aria-label="Clear the search"');
  });

  it('opens on the element the address names', () => {
    const html = reading('building_block|sales.refunds.Refund');
    expect(html).toMatch(/<h2[^>]*>Refund<\/h2>/);
    expect(html.match(/aria-selected="true"/g)).toHaveLength(1);
  });

  it('marks the way down to the element in hand, but not the element', () => {
    const html = reading('building_block|sales.refunds.Refund');
    // Two modules stand above it, and neither is the row in hand.
    expect(html.match(/data-ancestor/g)).toHaveLength(2);
    const chosen = html
      .split('<li')
      .find((row) => row.includes('data-selected'));
    expect(chosen).not.toContain('data-ancestor');
  });

  it('marks nothing above a row that is already at the top', () => {
    expect(page).not.toContain('data-ancestor');
  });

  it('falls back to the top when the address names nothing here', () => {
    // A design document is rewritten by the agent; a bookmark outlives the
    // element it named, and that is not a page to show an error on.
    expect(reading('building_block|gone.Away')).toMatch(/<h2[^>]*>sales<\/h2>/);
  });

  it('carries a search from the address into the outline', () => {
    const html = reading(null, 'aggregate');
    expect(html).toContain('<output');
    expect(html).toContain('aria-label="Clear the search"');
    expect(html).toMatch(/<mark[^>]*>aggregate<\/mark>/);
    expect(html.match(/role="treeitem"/g)).toHaveLength(3);
  });
});

describe('DesignDocWorkbench, opened where it was left', () => {
  const KEY = `noesis.designDocs.${designDocDetailFixture.document.id}.expanded`;
  const had = Object.hasOwn(globalThis, 'window');

  const leftShut = () => {
    const store = new Map([[KEY, '[]']]);
    Object.defineProperty(globalThis, 'window', {
      value: {
        sessionStorage: {
          getItem: (key: string) => store.get(key) ?? null,
          setItem: (key: string, value: string) => store.set(key, value),
        },
      },
      configurable: true,
      writable: true,
    });
  };

  afterEach(() => {
    if (!had) Reflect.deleteProperty(globalThis, 'window');
  });

  it('opens the branch the address points into, however it was left', () => {
    leftShut();
    const html = reading('building_block|sales.refunds.Refund');
    // Shut, the outline would be one row and the panel would be describing
    // an element the tree does not show.
    expect(html.match(/role="treeitem"/g)).toHaveLength(3);
    expect(html).toContain('aria-selected="true"');
  });

  it('leaves the rest of the tree as the reader left it', () => {
    leftShut();
    const html = reading(null);
    expect(html.match(/role="treeitem"/g)).toHaveLength(1);
  });
});
