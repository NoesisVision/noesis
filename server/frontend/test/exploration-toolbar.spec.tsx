import { describe, expect, it } from 'bun:test';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  type Drawing,
  ExplorationToolbar,
} from '../src/features/system-model/ui/exploration/exploration-toolbar';
import { MantineProvider } from '../src/shared/design-system/provider';

const toolbar = (drawing: Drawing) =>
  renderToStaticMarkup(
    <MantineProvider>
      <ExplorationToolbar
        canUndo
        canRedo={false}
        onUndo={() => {}}
        onRedo={() => {}}
        visibility={false}
        onVisibility={() => {}}
        veiledCount={0}
        drawing={drawing}
        onDrawing={() => {}}
        onAutoPlace={() => {}}
      >
        {null}
      </ExplorationToolbar>
    </MantineProvider>,
  );

describe('the exploration toolbar', () => {
  const html = toolbar({
    direction: 'vertical',
    orthogonal: true,
    animated: true,
  });

  it('offers which way the layout runs, and no other choice of how slots are drawn', () => {
    expect(html.match(/role="radiogroup"/g)).toHaveLength(1);
    expect(html).toContain('aria-label="Direction" role="radiogroup"');
  });

  it('sets which way the layout runs just before the button that places it', () => {
    const between = html.slice(
      html.indexOf('aria-label="Direction"'),
      html.indexOf('Auto-place'),
    );
    expect(between).not.toBe('');
    // One button between them: Auto-place itself.
    expect(between.match(/<button/g)).toHaveLength(1);
  });

  it('keeps placing everything afresh as quiet as the rest of the row', () => {
    // The button that holds the words itself, not one before it in the row.
    expect(html).toMatch(
      /<button[^>]*data-variant="subtle"[^>]*>(?:(?!<button).)*Auto-place/s,
    );
  });
});
