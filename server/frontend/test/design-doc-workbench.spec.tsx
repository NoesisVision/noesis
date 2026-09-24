import { describe, expect, it } from 'bun:test';
import { renderToStaticMarkup } from 'react-dom/server';
import { DesignDocWorkbench } from '../src/features/design-docs/ui/design-doc-workbench';
import { MantineProvider } from '../src/shared/design-system/provider';
import { designDocDetailFixture } from './fixtures/design-doc.fixture';

const page = renderToStaticMarkup(
  <MantineProvider>
    <DesignDocWorkbench detail={designDocDetailFixture} />
  </MantineProvider>,
);

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
});
