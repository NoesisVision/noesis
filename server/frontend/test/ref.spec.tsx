import { describe, expect, it } from 'bun:test';
import { renderToStaticMarkup } from 'react-dom/server';
import { Ref } from '../src/features/design-docs/ui/element-details/body/sections/ref';
import { MantineProvider } from '../src/shared/design-system/provider';

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
