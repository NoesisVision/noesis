import { expect, it } from 'bun:test';
import { IconFiles, IconPencilBolt } from '@tabler/icons-react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MantineProvider } from '../src/shared/design-system/provider';
import { DetailHeader } from '../src/shared/ui/detail-header';

const render = (markup: React.ReactNode) =>
  renderToStaticMarkup(<MantineProvider>{markup}</MantineProvider>);

it('names the item as the page heading', () => {
  const html = render(
    <DetailHeader title="Payment retry policy" icon={IconFiles} />,
  );
  expect(html).toContain('Payment retry policy');
  expect(html).toMatch(/<h2[^>]*>Payment retry policy<\/h2>/);
});

it('draws the icon of the kind it was given', () => {
  expect(render(<DetailHeader title="A" icon={IconFiles} />)).toContain(
    'tabler-icon-files',
  );
  expect(render(<DetailHeader title="A" icon={IconPencilBolt} />)).toContain(
    'tabler-icon-pencil-bolt',
  );
});
