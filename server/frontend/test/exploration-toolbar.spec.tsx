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

/** The option of the Slots control that is checked, by its value. */
const checkedSlots = (html: string) => {
  const group = html.slice(html.indexOf('aria-label="Slots"'));
  return /<input[^>]*checked=""[^>]*value="(\w+)"/.exec(group)?.[1];
};

describe('the exploration toolbar', () => {
  const drawing: Drawing = {
    direction: 'vertical',
    slots: 'cards',
    look: 'labels',
    orthogonal: true,
    animated: true,
  };

  it('offers slots on cards or as nodes, for the whole diagram', () => {
    const html = toolbar(drawing);
    expect(html).toContain('aria-label="Slots" role="radiogroup"');
    expect(html).toContain('On cards');
    expect(html).toContain('As nodes');
  });

  it('shows where slots are drawn now', () => {
    expect(checkedSlots(toolbar(drawing))).toBe('cards');
    expect(checkedSlots(toolbar({ ...drawing, slots: 'nodes' }))).toBe('nodes');
  });
});
