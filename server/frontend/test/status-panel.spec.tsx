import { expect, it } from 'bun:test';
import { renderToStaticMarkup } from 'react-dom/server';
import { MantineProvider } from '../src/shared/design-system/provider';
import { StatusPanel } from '../src/shared/ui/status-panel';

const render = (markup: React.ReactNode) =>
  renderToStaticMarkup(<MantineProvider>{markup}</MantineProvider>);

it('is the page heading when the panel is the whole page', () => {
  const html = render(<StatusPanel code="404" title="Not found" />);
  expect(html).toMatch(/<h1[^>]*>Not found<\/h1>/);
});

it('nests under the view heading when a headed view renders it', () => {
  const html = render(
    <StatusPanel headingLevel={2} title="No documents yet" />,
  );
  expect(html).toMatch(/<h2[^>]*>No documents yet<\/h2>/);
  expect(html).not.toContain('<h1');
});

it('shows the status beside the heading, never as one', () => {
  const html = render(<StatusPanel code="500" title="The service failed" />);
  expect(html).toContain('500');
  expect(html).not.toMatch(/<h[1-6][^>]*>500</);
});

it('leaves out what it was not given', () => {
  const bare = render(<StatusPanel title="No changes yet" />);
  expect(bare).not.toContain('404');
  expect(bare).not.toContain('<button');

  const full = render(
    <StatusPanel
      code="404"
      title="Not found"
      description="Nothing is here."
      action={<button type="button">Back</button>}
    />,
  );
  expect(full).toContain('Nothing is here.');
  expect(full).toContain('<button type="button">Back</button>');
});

it('says a failure out loud, and an answer quietly', () => {
  expect(render(<StatusPanel announce title="The service failed" />)).toContain(
    'role="alert"',
  );
  expect(render(<StatusPanel title="No changes yet" />)).not.toContain(
    'role="alert"',
  );
});
