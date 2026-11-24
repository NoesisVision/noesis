import { describe, expect, it } from 'bun:test';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  type Drawing,
  ExplorationToolbar,
} from '../src/features/system-model/ui/exploration/exploration-toolbar';
import { MantineProvider } from '../src/shared/design-system/provider';

const toolbar = (
  drawing: Drawing,
  onlyDesign?: { onShow: () => void; drawn: boolean },
) =>
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
        onlyDesign={onlyDesign}
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

describe('the toolbar over a design drawn among the model', () => {
  const drawing = { orthogonal: true, animated: true };
  /** The button that holds the words itself, not one before it in the row. */
  const button = (html: string) =>
    /<button(?:(?!<button)[^>])*>(?:(?!<button).)*Only the design/s.exec(
      html,
    )?.[0] ?? null;

  it('offers no way back to the design on the model’s own exploration', () => {
    expect(toolbar(drawing)).not.toContain('Only the design');
  });

  it('draws the design alone again, while more than the design is drawn', () => {
    const offered = button(
      toolbar(drawing, { onShow: () => {}, drawn: false }),
    );
    expect(offered).not.toBeNull();
    expect(offered).not.toContain('disabled');
  });

  it('is not offered while the design alone is drawn', () => {
    expect(
      button(toolbar(drawing, { onShow: () => {}, drawn: true })),
    ).toContain('disabled');
  });
});
