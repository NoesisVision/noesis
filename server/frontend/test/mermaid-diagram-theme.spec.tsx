import { expect, it } from 'bun:test';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  type MantineTheme,
  useMantineTheme,
} from '../src/shared/design-system/hooks';
import { MantineProvider } from '../src/shared/design-system/provider';
import { theme } from '../src/shared/design-system/theme';
import {
  asDropShadow,
  diagramCss,
  type DiagramTheme,
  diagramTheme,
} from '../src/shared/ui/mermaid-diagram-theme';

/** The palette as the app resolves it, not a stand-in built for the test. */
function paletteOf(scheme: 'light' | 'dark'): DiagramTheme {
  return painted((theme) => diagramTheme(theme, scheme));
}

/** The rules as the app writes them, for the same scheme. */
function cssOf(scheme: 'light' | 'dark'): string[] {
  return painted((theme) => diagramCss(theme, scheme))
    .split('\n')
    .map((rule) => rule.trim())
    .filter((rule) => rule !== '');
}

/** The one rule the app writes for `selector`, brackets and all. */
function ruleOf(scheme: 'light' | 'dark', selector: string): string {
  const rule = cssOf(scheme).find((rule) => rule.startsWith(`${selector} {`));
  expect(rule).toBeDefined();
  return rule ?? '';
}

/** Whatever the palette produces, read off the theme the app resolves. */
function painted<T>(paint: (theme: MantineTheme) => T): T {
  function Probe() {
    return <div data-palette={JSON.stringify(paint(useMantineTheme()))} />;
  }
  const html = renderToStaticMarkup(
    <MantineProvider theme={theme}>
      <Probe />
    </MantineProvider>,
  );
  const written = /data-palette="([^"]*)"/.exec(html)?.[1] ?? '';
  return JSON.parse(written.replaceAll('&quot;', '"')) as T;
}

it('hands mermaid colours it can compute on, never CSS variables', () => {
  // Mermaid derives the edges and every border it is not given by inverting
  // and darkening these, which it cannot do to `var(--mantine-…)`.
  for (const scheme of ['light', 'dark'] as const) {
    for (const [name, value] of Object.entries(paletteOf(scheme))) {
      if (!name.toLowerCase().includes('color') && name !== 'background') {
        continue;
      }
      expect(value).not.toContain('var(');
      expect(value).toMatch(/^#[0-9a-f]{3,8}$/i);
    }
  }
});

it('paints the two colour schemes apart', () => {
  const light = paletteOf('light');
  const dark = paletteOf('dark');
  expect(light.primaryColor).not.toBe(dark.primaryColor);
  expect(light.background).not.toBe(dark.background);
});

it('strokes a node with a solid border rather than a gradient', () => {
  // The `neo` look otherwise strokes with `url(#…-gradient)`, which mermaid
  // swaps for `nodeBorder` only when this is off.
  expect(paletteOf('light').useGradient).toBe(false);
  expect(paletteOf('dark').useGradient).toBe(false);
});

it('turns a Mantine box-shadow into the filter mermaid sets', () => {
  // `xs`: two layers, colour trailing, no spread — it converts untouched.
  expect(
    asDropShadow(
      '0 0.0625rem 0.1875rem rgba(0, 0, 0, 0.05), 0 0.0625rem 0.125rem rgba(0, 0, 0, 0.1)',
    ),
  ).toBe(
    'drop-shadow(0 0.0625rem 0.1875rem rgba(0, 0, 0, 0.05)) drop-shadow(0 0.0625rem 0.125rem rgba(0, 0, 0, 0.1))',
  );
});

it('reads a layer whose colour leads it, and drops the spread', () => {
  // `drop-shadow()` has no fourth length, so `-0.3125rem` has nowhere to go.
  expect(
    asDropShadow('rgba(0, 0, 0, 0.05) 0 0.625rem 0.9375rem -0.3125rem'),
  ).toBe('drop-shadow(0 0.625rem 0.9375rem rgba(0, 0, 0, 0.05))');
});

it('splits on the commas between layers, never the ones inside a colour', () => {
  const converted = asDropShadow(
    '0 1px 3px rgba(0, 0, 0, 0.05), rgba(0, 0, 0, 0.04) 0 7px 7px -5px',
  );
  expect(converted.match(/drop-shadow\(/g)).toHaveLength(2);
  expect(converted).toContain('drop-shadow(0 1px 3px rgba(0, 0, 0, 0.05))');
  expect(converted).toContain('drop-shadow(0 7px 7px rgba(0, 0, 0, 0.04))');
});

it('leaves out an inset layer, which a filter cannot paint', () => {
  expect(asDropShadow('inset 0 1px 2px #000, 0 2px 4px #333')).toBe(
    'drop-shadow(0 2px 4px #333)',
  );
});

it('gives the diagram the shadow the rest of the app is raised by', () => {
  const shadow = paletteOf('light').dropShadow;
  expect(shadow).toContain('drop-shadow(');
  expect(shadow).not.toContain('box-shadow');
  // mermaid's own default is an opaque grey that only suits a light canvas.
  expect(shadow).not.toContain('185,185,185');
});

it('keeps a length that a resolved Mantine theme wraps in calc()', () => {
  // `calc(… * var(--mantine-scale))` is the shape every length arrives in, and
  // it holds its own spaces and brackets.
  expect(
    asDropShadow(
      'rgba(0, 0, 0, 0.05) 0 calc(0.625rem * var(--mantine-scale)) calc(0.9375rem * var(--mantine-scale)) calc(-0.3125rem * var(--mantine-scale))',
    ),
  ).toBe(
    'drop-shadow(0 calc(0.625rem * var(--mantine-scale)) calc(0.9375rem * var(--mantine-scale)) rgba(0, 0, 0, 0.05))',
  );
});

it('refuses a variable mermaid would silently ignore', () => {
  // `themeVariables` is `any` in mermaid's own types, so this interface is the
  // only thing between a misspelling and a diagram that quietly ignores it.
  const named: DiagramTheme = { nodeBorder: '#000' };
  expect(named.nodeBorder).toBe('#000');

  // @ts-expect-error 'nodeBorderr' is not a mermaid theme variable
  const misspelled: DiagramTheme = { nodeBorderr: '#000' };
  expect(misspelled).toBeDefined();

  // @ts-expect-error dropShadow is a filter value, never a box-shadow number
  const wrongType: DiagramTheme = { dropShadow: 4 };
  expect(wrongType).toBeDefined();
});

it('outweighs the rule it replaces rather than merely following it', () => {
  // Mermaid namespaces both its own rules and this CSS under the diagram id
  // and puts this one first, so an equal selector would lose on order.
  for (const rule of cssOf('light')) {
    const selector = rule.slice(0, rule.indexOf('{')).trim();
    const first = selector.split(/[\s,]+/)[0] ?? '';
    expect(first.split('.').length).toBeGreaterThan(2);
  }
});

it('leans on specificity rather than !important, and carries no comments', () => {
  // Mermaid parses the CSS with `CSSStyleSheet.replaceSync`, which drops
  // anything it cannot read — every comment included.
  const css = cssOf('dark').join('\n');
  expect(css).not.toContain('!important');
  expect(css).not.toContain('/*');
});

it('writes colours a browser can read, never a doubled hash', () => {
  for (const scheme of ['light', 'dark'] as const) {
    const css = cssOf(scheme).join('\n');
    expect(css).not.toMatch(/##/);
    for (const [colour] of css.matchAll(/#[0-9a-f]+/gi)) {
      expect(colour).toMatch(/^#[0-9a-f]{3,8}$/i);
    }
  }
});

it('paints an edge label the colour of the edge it labels', () => {
  // Mermaid strokes `.flowchart-link` with `lineColor`, so naming that same
  // colour is what sets the chip on the line rather than beside it.
  for (const scheme of ['light', 'dark'] as const) {
    const line = paletteOf(scheme).lineColor;
    expect(line).toBeDefined();
    expect(ruleOf(scheme, '.labelBkg.labelBkg')).toContain(
      `background: ${line};`,
    );
    // Mermaid fades `edgeLabelBackground` by a hardcoded half to paint the
    // chip itself, so the theme variable has to name the colour the CSS does.
    expect(paletteOf(scheme).secondaryColor).toBe(line);
  }
  expect(cssOf('light')).not.toEqual(cssOf('dark'));
});

it('leaves the chip unoutlined, the fill being the whole of it', () => {
  for (const scheme of ['light', 'dark'] as const) {
    expect(ruleOf(scheme, '.labelBkg.labelBkg')).toContain('border: none;');
  }
});

it('writes an edge label in white, on either scheme', () => {
  // The chip is the line's colour in both, which neither text colour the
  // palette reads well against — white is the one that carries across.
  for (const scheme of ['light', 'dark'] as const) {
    expect(ruleOf(scheme, '.edgeLabel.edgeLabel')).toContain('color: #fff;');
  }
});
