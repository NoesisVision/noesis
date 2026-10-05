import { expect, it } from 'bun:test';
import { renderToStaticMarkup } from 'react-dom/server';
import { MantineProvider } from '../src/shared/design-system/provider';
import { ZoomControls } from '../src/shared/ui/zoom-controls';

const nothing = () => {};

const render = (markup: React.ReactNode) =>
  renderToStaticMarkup(<MantineProvider>{markup}</MantineProvider>);

const namesOf = (html: string) =>
  [...html.matchAll(/<button[^>]*aria-label="([^"]+)"/g)].map(
    ([, name]) => name,
  );

it('groups the buttons under one name and says how far in the canvas is', () => {
  const html = render(
    <ZoomControls
      zoom={1.254}
      onZoomOut={nothing}
      onZoomIn={nothing}
      onFit={nothing}
    />,
  );
  expect(html).toMatch(/<fieldset[^>]*>\s*<legend[^>]*>Zoom<\/legend>/);
  expect(html).toMatch(/<output[^>]*>125%<\/output>/);
  expect(namesOf(html)).toEqual(['Zoom out', 'Zoom in', 'Fit to view']);
});

it('offers the actual size only to a canvas that has one', () => {
  const html = render(
    <ZoomControls
      zoom={1}
      onZoomOut={nothing}
      onZoomIn={nothing}
      onFit={nothing}
      onActualSize={nothing}
    />,
  );
  expect(namesOf(html)).toEqual([
    'Zoom out',
    'Zoom in',
    'Fit to view',
    'Actual size',
  ]);
});

it('takes no press while the canvas is not there yet', () => {
  const html = render(
    <ZoomControls
      zoom={1}
      disabled
      onZoomOut={nothing}
      onZoomIn={nothing}
      onFit={nothing}
    />,
  );
  expect(html.match(/<button[^>]*\sdisabled=""/g)).toHaveLength(3);
});
