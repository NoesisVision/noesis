import { describe, expect, it } from 'bun:test';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  buildingBlockTypesOf,
  withoutTypes,
} from '../src/features/design-docs/building-block-types';
import { architectureOf } from '../src/features/design-docs/design-doc-architecture';
import { ArchitectureDiagram } from '../src/features/design-docs/ui/architecture/architecture-diagram';
import {
  adapterOutId,
  layoutArchitecture,
} from '../src/features/design-docs/ui/architecture/layout-architecture';
import { MantineProvider } from '../src/shared/design-system/provider';
import { qdocArchitectureFixture } from './fixtures/design-doc-architecture.fixture';

const outline = architectureOf(qdocArchitectureFixture);
const types = buildingBlockTypesOf(outline.hexagons);

const SERVICE = 'building_block|qdocmanagement.preparation.QDocCreationService';
const CREATE =
  'behavior|qdocmanagement.preparation.QDocCreationService.createQDoc';
const REPOSITORY = 'building_block|qdocmanagement.preparation.QDocRepository';
const QDOC_ID = 'building_block|qdocmanagement.preparation.QDocId';

const idsOf = (hidden: string[]) =>
  new Set(
    layoutArchitecture(
      withoutTypes(outline.hexagons, new Set(hidden)),
    ).nodes.map(({ id }) => id),
  );

function render(hidden: string[]): string {
  return renderToStaticMarkup(
    <MantineProvider>
      <ArchitectureDiagram
        outline={outline}
        layout={layoutArchitecture(
          withoutTypes(outline.hexagons, new Set(hidden)),
        )}
        focus={{ selected: new Set(), related: new Set() }}
        onSelectElement={() => {}}
        types={types}
        hiddenTypes={new Set(hidden)}
        onHideTypes={() => {}}
      />
    </MantineProvider>,
  );
}

describe('buildingBlockTypesOf', () => {
  it('counts every type the hexagons draw, by the ring it sits in', () => {
    expect(types).toEqual([
      {
        ring: 'Application',
        types: [{ pattern: 'application_service', count: 2 }],
      },
      {
        ring: 'Domain core',
        types: [
          { pattern: 'aggregate', count: 1 },
          { pattern: 'entity', count: 2 },
          { pattern: 'domain_service', count: 1 },
          { pattern: 'value_object', count: 16 },
        ],
      },
      {
        ring: 'Driven ports',
        types: [
          { pattern: 'repository', count: 1 },
          { pattern: 'external_integration', count: 3 },
        ],
      },
    ]);
  });
});

describe('withoutTypes', () => {
  it('leaves the hexagons as they are when nothing is hidden', () => {
    expect(withoutTypes(outline.hexagons, new Set())).toBe(outline.hexagons);
  });

  it('draws no card of a hidden type, and no adapter for a hidden port', () => {
    const ids = idsOf(['value_object', 'repository']);
    expect(ids.has(QDOC_ID)).toBe(false);
    expect(ids.has(REPOSITORY)).toBe(false);
    expect(ids.has(adapterOutId(REPOSITORY))).toBe(false);
    expect(ids.has('building_block|qdocmanagement.preparation.QDoc')).toBe(
      true,
    );
  });

  it('keeps the driving ports, and draws no line to a service left out', () => {
    const drawn = layoutArchitecture(
      withoutTypes(outline.hexagons, new Set(['application_service'])),
    );
    expect(drawn.nodes.some(({ id }) => id === CREATE)).toBe(true);
    expect(drawn.nodes.some(({ id }) => id === SERVICE)).toBe(false);
    expect(drawn.edges.some(({ target }) => target === SERVICE)).toBe(false);
  });

  it('lays the core out afresh, so a hidden type leaves no gap', () => {
    const height = (hidden: string[]) =>
      layoutArchitecture(withoutTypes(outline.hexagons, new Set(hidden)))
        .height;
    expect(height(['value_object'])).toBeLessThan(height([]));
  });
});

describe('the building block filter in the diagram', () => {
  it('shows no count when nothing is left out', () => {
    const html = render([]);
    expect(html).toContain('Building blocks');
    expect(html).not.toContain(' of 7');
  });

  it('counts the types shown on its button, and nothing else names them', () => {
    const html = render(['value_object', 'entity']);
    expect(html).toContain('5 of 7');
    expect(html).not.toContain('Hiding');
    expect(html).not.toContain('aria-label="Show every building block"');
    expect(html).not.toContain('aria-label="QDocId,');
  });
});
