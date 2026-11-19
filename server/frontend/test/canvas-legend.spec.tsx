import { describe, expect, it } from 'bun:test';
import { IconKeyboard } from '@tabler/icons-react';
import { renderToStaticMarkup } from 'react-dom/server';
import { ShortcutLegend } from '../src/features/system-model/ui/exploration/shortcut-legend';
import { MantineProvider } from '../src/shared/design-system/provider';
import { CanvasLegend } from '../src/shared/ui/canvas-legend';

const render = (legend: React.ReactNode) =>
  renderToStaticMarkup(<MantineProvider>{legend}</MantineProvider>);

/** The button a legend is folded and opened by. */
const toggleOf = (html: string) =>
  html.match(/<button[^>]*aria-expanded="false"[^>]*>.*?<\/button>/s)?.[0] ??
  '';

describe('a canvas legend, folded', () => {
  it('reads its title beside its icon', () => {
    const toggle = toggleOf(
      render(
        <CanvasLegend title="Legend" icon={IconKeyboard}>
          <p>What each colour means</p>
        </CanvasLegend>,
      ),
    );
    expect(toggle).toMatch(/<span[^>]*>Legend<\/span>/);
    expect(toggle).not.toContain('aria-label');
  });

  it('is its icon alone when it folds to it, its title still its name', () => {
    const html = render(
      <CanvasLegend title="Legend" icon={IconKeyboard} foldsToIcon>
        <p>What each colour means</p>
      </CanvasLegend>,
    );
    const toggle = toggleOf(html);
    expect(toggle).toContain('aria-label="Legend"');
    expect(toggle).not.toContain('>Legend<');
    // The icon, and no chevron beside it.
    expect(toggle.match(/<svg/g)).toHaveLength(1);
    expect(html).toMatch(/<section[^>]*data-icon-alone="true"/);
    // What it folds away is still in the page, only not shown.
    expect(html).toContain('What each colour means');
  });
});

describe('the exploration’s keyboard shortcuts, folded', () => {
  it('are a keyboard alone, named for a screen reader', () => {
    const html = render(<ShortcutLegend />);
    expect(html).toMatch(/<section[^>]*aria-label="Keyboard shortcuts"/);
    const toggle = toggleOf(html);
    expect(toggle).toContain('aria-label="Keyboard shortcuts"');
    expect(toggle).not.toContain('>Keyboard shortcuts<');
  });
});
