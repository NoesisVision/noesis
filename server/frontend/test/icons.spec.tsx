import { describe, expect, it } from 'bun:test';
import { readFileSync } from 'node:fs';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  IconChevronsDownUp,
  IconChevronsUpDown,
} from '../src/shared/ui/icons/icons';

const pathsOf = (svg: string) =>
  [...svg.matchAll(/<path d="([^"]+)"/g)].map((match) => match[1]);

const source = (name: string) =>
  readFileSync(
    new URL(`../src/shared/ui/icons/${name}.svg`, import.meta.url),
    'utf8',
  );

describe('icons', () => {
  it.each([
    ['chevrons-up-down', IconChevronsUpDown],
    ['chevrons-down-up', IconChevronsDownUp],
  ] as const)('%s draws what its .svg draws', (name, Icon) => {
    const html = renderToStaticMarkup(<Icon />);
    expect(pathsOf(html)).toEqual(pathsOf(source(name)));
  });

  it('takes the Tabler props', () => {
    const html = renderToStaticMarkup(
      <IconChevronsUpDown size={18} stroke={1.6} aria-hidden />,
    );
    expect(html).toContain('width="18"');
    expect(html).toContain('stroke-width="1.6"');
    expect(html).toContain('aria-hidden="true"');
    expect(html).toContain('tabler-icon-chevrons-up-down');
  });
});
