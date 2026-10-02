import { describe, expect, it } from 'bun:test';
import { renderToStaticMarkup } from 'react-dom/server';
import { MantineProvider } from '../src/shared/design-system/provider';
import {
  QualifiedName,
  shortLabel,
  shortName,
} from '../src/shared/ui/qualified-name';

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

describe('QualifiedName', () => {
  const render = (node: React.ReactNode) =>
    renderToStaticMarkup(<MantineProvider>{node}</MantineProvider>);

  it.each([
    ['a.b.C', 'C'],
    ['name: a.b.C', 'name: C'],
    ['name: a.b.C[]', 'name: C[]'],
    ['string', 'string'],
  ])('reads %j as %j', (name, short) => {
    expect(render(<QualifiedName name={name} />)).toContain(`>${short}<`);
  });

  it('never prints the address it cuts', () => {
    expect(render(<QualifiedName name="name: a.b.C" />)).not.toContain('a.b.C');
  });

  it('draws the short label in the element it is given', () => {
    const html = render(
      <QualifiedName name="a.b.C" render={(short) => <code>{short}</code>} />,
    );
    expect(html).toMatch(/<code[^>]*>C<\/code>/);
  });
});
