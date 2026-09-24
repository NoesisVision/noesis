import { expect, it } from 'bun:test';
import { IconFiles } from '@tabler/icons-react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MantineProvider } from '../src/shared/design-system/provider';
import { ReadingPane } from '../src/shared/ui/reading-pane';

const pane = renderToStaticMarkup(
  <MantineProvider>
    <ReadingPane
      title="Payment retry policy"
      icon={IconFiles}
      description="2026-09-14"
    >
      <p>What the document says.</p>
    </ReadingPane>
  </MantineProvider>,
);

it('heads the page with the item, under the icon of its kind', () => {
  expect(pane).toMatch(/<h1[^>]*>Payment retry policy<\/h1>/);
  expect(pane).toContain('tabler-icon-files');
  expect(pane).toContain('What the document says.');
  // The pane holds the page's one heading; the document nests under it.
  expect(pane.match(/<h1/g)).toHaveLength(1);
  expect(pane).toContain('<article');
});

it('names both widths, which the switch shows as icons alone', () => {
  expect(pane).toContain('role="radiogroup"');
  expect(pane).toContain('aria-label="Content width"');
  expect(pane).toContain('Convenient');
  expect(pane).toContain('Full width');
});

it('reads at the convenient width until told otherwise', () => {
  // The column says which width it is at, so the CSS and a reader of this
  // markup agree without a class name, which `bun test` cannot see.
  expect(pane).toContain('data-width="convenient"');
  // The width in force is also the checked radio — a state, not a colour.
  expect(pane).toMatch(/checked=""[^>]*value="convenient"/);
  expect(pane).not.toMatch(/checked=""[^>]*value="full"/);
});

it('names the full-screen button, which is an icon on its own', () => {
  expect(pane).toContain('aria-label="Full screen"');
  expect(pane).toContain('tabler-icon-maximize');
});

it('keeps the controls off a small screen, where they say nothing', () => {
  // The same width the shell folds its sidebar at.
  expect(pane).toContain('mantine-visible-from-md');
});
