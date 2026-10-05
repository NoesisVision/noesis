import { describe, expect, it } from 'bun:test';
import { renderToStaticMarkup } from 'react-dom/server';
import { buildingBlockTypesOf } from '../src/features/design-docs/building-block-types';
import { architectureOf } from '../src/features/design-docs/design-doc-architecture';
import { ArchitectureDiagram } from '../src/features/design-docs/ui/architecture/architecture-diagram';
import { layoutArchitecture } from '../src/features/design-docs/ui/architecture/layout-architecture';
import { MantineProvider } from '../src/shared/design-system/provider';
import { qdocArchitectureFixture } from './fixtures/design-doc-architecture.fixture';

const outline = architectureOf(qdocArchitectureFixture);

const html = renderToStaticMarkup(
  <MantineProvider>
    <ArchitectureDiagram
      outline={outline}
      layout={layoutArchitecture(outline.hexagons)}
      focus={{ selected: new Set(), related: new Set() }}
      onSelectElement={() => {}}
      types={buildingBlockTypesOf(outline.hexagons)}
      hiddenTypes={new Set()}
      onHideTypes={() => {}}
    />
  </MantineProvider>,
);

const legend = html.slice(html.indexOf('react-flow__panel'));

describe('the diagram legend', () => {
  it('floats over the canvas in a React Flow panel', () => {
    expect(html).toContain('react-flow__panel');
    expect(legend).toContain('aria-label="Legend: pick out a kind of card"');
  });

  it('sits in the bottom right corner, the attribution moved out of its way', () => {
    expect(legend).toMatch(/^react-flow__panel[^"]*bottom right/);
    expect(html).toMatch(
      /react-flow__panel[^"]*bottom left[^"]*react-flow__attribution|react-flow__attribution[^"]*bottom left/,
    );
  });

  it('starts folded behind a toggle that says it is closed', () => {
    const toggle = legend.match(
      /<button[^>]*aria-expanded="false"[^>]*aria-controls="([^"]+)"[^>]*>Legend/,
    );
    expect(toggle).not.toBeNull();
    expect(legend).toMatch(new RegExp(`<ul[^>]*id="${toggle?.[1]}" hidden=""`));
  });

  it('names every drawn kind once, in the order the cards are drawn', () => {
    const labels = [
      ...legend.matchAll(/aria-pressed="false">(?:<[^>]+><\/span>)?([^<]+)</g),
    ].map(([, label]) => label);
    expect(labels).toEqual([
      'In / out adapter',
      'Driving port',
      'Application service',
      'Domain core',
      'Driven port',
    ]);
  });

  it('gives each swatch the look its cards have', () => {
    // Both are marked with the kind, which is what the stylesheet draws by.
    expect(legend).toMatch(
      /<span[^>]*data-kind="drivingPort"[^>]*><\/span>Driving port/,
    );
    expect(html).toMatch(/<button[^>]*data-kind="drivingPort"/);
  });
});

describe('the change marks on the cards', () => {
  it('can be switched off from the toolbar', () => {
    expect(html).toMatch(/<input[^>]*checked=""[^>]*>[\s\S]*?Changes</);
  });

  it('mark each changed element as the tree does, and say so in its name', () => {
    const card = html.match(
      /<button[^>]*aria-label="QDocId,[^"]*added[^"]*"[\s\S]*?<\/button>/,
    );
    expect(card).not.toBeNull();
    expect(card?.[0]).toContain('data-change="added"');
    expect(card?.[0]).toMatch(/<svg[^>]*viewBox="0 0 9 9"[^>]*style="color:/);
  });
});
