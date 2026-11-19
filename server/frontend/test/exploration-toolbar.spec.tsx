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
  const html = toolbar({ orthogonal: true, animated: true });

  it('offers no way for the layout to run: one button reorders everything', () => {
    expect(html).not.toContain('role="radiogroup"');
    expect(html).not.toContain('Direction');
    expect(html.match(/Reorder diagram/g)).toHaveLength(1);
    // The name it had, and the trial beside it, are gone.
    expect(html).not.toContain('Auto-place');
  });

  it('keeps reordering everything as quiet as the rest of the row', () => {
    // The button that holds the words itself, not one before it in the row.
    expect(html).toMatch(
      /<button[^>]*data-variant="subtle"[^>]*>(?:(?!<button).)*Reorder diagram/s,
    );
  });
});
