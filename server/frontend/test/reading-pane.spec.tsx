import { expect, it } from 'bun:test';
import { renderToStaticMarkup } from 'react-dom/server';
import { MantineProvider } from '../src/shared/design-system/provider';
import { ReadingPane } from '../src/shared/ui/reading-pane';

const pane = renderToStaticMarkup(
  <MantineProvider>
    <ReadingPane
      title="Payment retry policy"
      eyebrow="Document"
      meta="2026-09-14"
    >
      <p>What the document says.</p>
    </ReadingPane>
  </MantineProvider>,
);

it('heads the page with the item, under its kind and what else is known', () => {
  expect(pane).toMatch(/<h1[^>]*>Payment retry policy<\/h1>/);
  expect(pane).toContain('Document');
  expect(pane).toContain('2026-09-14');
  expect(pane).toContain('What the document says.');
  // The pane holds the page's one heading; the document nests under it.
  expect(pane.match(/<h1/g)).toHaveLength(1);
  expect(pane).toContain('<article');
});

it('offers no width to switch to: a document is read at one', () => {
  expect(pane).not.toContain('role="radiogroup"');
  expect(pane).not.toContain('Content width');
});

it('leaves full screen to the top bar', () => {
  expect(pane).not.toContain('aria-label="Full screen"');
});

it('marks the header only once the document has run under it', () => {
  // Nothing has scrolled in a static render, so the edge is not drawn yet.
  expect(pane).not.toContain('data-stuck');
});
