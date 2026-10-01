import { describe, expect, it } from 'bun:test';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  Ref,
  shortLabel,
  shortName,
} from '../src/features/design-docs/ui/element-details/body/sections/ref';
import { MantineProvider } from '../src/shared/design-system/provider';

describe('shortName', () => {
  it.each([
    ['string', { type: 'string' }],
    ['a.b.C', { type: 'C' }],
    ['name: string', { name: 'name', type: 'string' }],
    ['name: a.b.C', { name: 'name', type: 'C' }],
    ['name:a.b.C', { name: 'name', type: 'C' }],
    ['  name  :  a.b.C  ', { name: 'name', type: 'C' }],
  ])('splits %j into %j', (ref, parts) => {
    expect(shortName(ref)).toEqual(parts);
  });

  it('leaves the name out of a bare type rather than leaving it undefined', () => {
    expect('name' in shortName('a.b.C')).toBe(false);
  });
});

describe('shortLabel', () => {
  it.each([
    ['string', 'string'],
    ['a.b.C', 'C'],
    ['name: string', 'name: string'],
    ['name: a.b.C', 'name: C'],
  ])('reads %j as %j', (ref, label) => {
    expect(shortLabel(ref)).toBe(label);
  });
});

describe('Ref', () => {
  const render = (name: string, qualified?: boolean) =>
    renderToStaticMarkup(
      <MantineProvider>
        <Ref change="unchanged" name={name} qualified={qualified} />
      </MantineProvider>,
    );

  it('shows a qualified reference by its short label', () => {
    const html = render('name: a.b.C', true);
    expect(html).toContain('>name: C<');
    expect(html).not.toContain('a.b.C<');
  });

  it('shows an unqualified reference whole', () => {
    expect(render('name: a.b.C')).toContain('>name: a.b.C<');
  });
});
