import { expect, it } from 'bun:test';
import { IconFiles, IconPencilBolt } from '@tabler/icons-react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MantineProvider } from '../src/shared/design-system/provider';
import { IconHeading } from '../src/shared/ui/icon-heading';

const render = (markup: React.ReactNode) =>
  renderToStaticMarkup(<MantineProvider>{markup}</MantineProvider>);

it('names the item as the page heading, which is the h1', () => {
  const html = render(
    <IconHeading title="Payment retry policy" icon={IconFiles} />,
  );
  expect(html).toContain('Payment retry policy');
  expect(html).toMatch(/<h1[^>]*>Payment retry policy<\/h1>/);
});

it('draws the icon of the kind it was given', () => {
  expect(render(<IconHeading title="A" icon={IconFiles} />)).toContain(
    'tabler-icon-files',
  );
  expect(render(<IconHeading title="A" icon={IconPencilBolt} />)).toContain(
    'tabler-icon-pencil-bolt',
  );
});

it('adds a line under the title only when a view needs one', () => {
  const withDescription = render(
    <IconHeading
      title="Documents"
      icon={IconFiles}
      description="Imported material that informs the change"
    />,
  );
  expect(withDescription).toContain(
    'Imported material that informs the change',
  );

  const bare = render(
    <IconHeading title="Payment retry policy" icon={IconFiles} />,
  );
  expect(bare).toContain('Payment retry policy');
  // No second line at all — `<p` would match the icon's own `<path>`.
  expect(bare).not.toContain('mantine-Text-root');
});

it('drops to the level it is given, keeping the type scale', () => {
  const html = render(
    <IconHeading
      title="Payment retry policy"
      icon={IconFiles}
      headingLevel={3}
    />,
  );
  // Heading a card inside a list, not the page the list is on.
  expect(html).toMatch(/<h3[^>]*>Payment retry policy<\/h3>/);
  expect(html).not.toContain('<h1');
});
