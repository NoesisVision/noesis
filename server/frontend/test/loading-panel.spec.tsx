import { expect, it } from 'bun:test';
import { renderToStaticMarkup } from 'react-dom/server';
import { MantineProvider } from '../src/shared/design-system/provider';
import { LoadingPanel } from '../src/shared/ui/loading-panel';

const html = renderToStaticMarkup(
  <MantineProvider>
    <LoadingPanel label="Loading documents…" />
  </MantineProvider>,
);

it('says the wait in a live region, so it is announced', () => {
  expect(html).toMatch(/<output[^>]*>Loading documents…<\/output>/);
});

it('draws the spinner, and hides it from what reads the line', () => {
  expect(html).toContain('mantine-Loader-root');
  expect(html).toMatch(/<span[^>]*mantine-Loader-root[^>]*aria-hidden="true"/);
});

it('adds nothing to the outline of a page it is only passing through', () => {
  expect(html).not.toMatch(/<h[1-6]/);
  // `role="alert"` would say it twice: the `output` already announces.
  expect(html).not.toContain('role="alert"');
});
