import { describe, expect, it, mock } from 'bun:test';
import { renderToStaticMarkup } from 'react-dom/server';
import type { DesignDocumentInput } from '#backend/app/design-docs/design-doc.ts';
import { outlineOf } from '../src/features/design-docs/design-doc-outline';
import { ElementDetail } from '../src/features/design-docs/ui/element-details/element-detail';
import { outlineTree } from '../src/features/design-docs/ui/model-tree/outline-tree';
import { MantineProvider } from '../src/shared/design-system/provider';

void mock.module(
  '../src/features/design-docs/ui/element-details/markdown-reading.tsx',
  () => ({
    MarkdownReading: ({ markdown }: { markdown: string }) => (
      <span data-markdown>{markdown}</span>
    ),
  }),
);

const plain = <const T,>(value: T) => ({ value, author: 'agent' as const });

const API = 'deployable_unit|shop-api';
const SALES = 'library|MyCompany.Sales';
const REFUNDS = 'module|sales.refunds';
const REFUND = 'building_block|sales.refunds.Refund';
const DOMAIN = 'layer|domain';
const CLUSTER = 'deployment_container|Shop cluster';

const document = {
  id: 'doc',
  name: 'Refunds',
  description: '',
  modules: { added: [{ id: REFUNDS }] },
  buildingBlocks: {
    added: [{ id: REFUND, type: plain('aggregate') }],
  },
  deployableUnits: {
    added: [
      { id: API, name: plain('shop-api'), definition: plain('The shop.') },
    ],
  },
  libraries: {
    added: [
      {
        id: SALES,
        name: plain('MyCompany.Sales'),
        definition: plain('The sales domain.'),
      },
    ],
  },
  layers: {
    added: [
      { id: DOMAIN, name: plain('domain'), definition: plain('The rules.') },
    ],
  },
  deploymentContainers: {
    added: [
      {
        id: CLUSTER,
        name: plain('Shop cluster'),
        definition: plain('Where the shop runs.'),
      },
    ],
  },
  relations: {
    added: [
      { kind: 'unit_contains_module', from: API, to: REFUNDS },
      { kind: 'library_contains_block', from: SALES, to: REFUND },
      { kind: 'layer_contains_block', from: DOMAIN, to: REFUND },
      { kind: 'container_contains_unit', from: CLUSTER, to: API },
    ],
  },
} satisfies DesignDocumentInput;

describe('the outline', () => {
  it('roots deployable units, libraries, layers and deployment containers after the modules, each by its whole name', () => {
    const roots = outlineOf(document).filter(
      (node) => node.parentPath === null,
    );
    expect(roots.map((node) => [node.path, node.kind, node.name])).toEqual([
      ['module|sales', 'module', 'sales'],
      [API, 'deployable_unit', 'shop-api'],
      [SALES, 'library', 'MyCompany.Sales'],
      [DOMAIN, 'layer', 'domain'],
      [CLUSTER, 'deployment_container', 'Shop cluster'],
    ]);
  });
});

describe('the panels', () => {
  const tree = outlineTree(outlineOf(document), []);
  const show = (path: string) => {
    const node = tree.byPath.get(path)!;
    return renderToStaticMarkup(
      <MantineProvider>
        <ElementDetail
          node={node}
          path={tree
            .ancestryOf(path)
            .map((step) => tree.byPath.get(step))
            .filter((step) => step !== undefined)}
          document={document}
          onSelect={() => {}}
          tree={tree}
        />
      </MantineProvider>,
    );
  };

  it('says what a deployable unit and a library contain', () => {
    const unit = show(API);
    expect(unit).toMatch(/<h2[^>]*>shop-api<\/h2>/);
    expect(unit).toMatch(/Contains<\/span> <span[^>]*>1</);
    expect(unit).toContain('>refunds<');
    const library = show(SALES);
    expect(library).toMatch(/<h2[^>]*>MyCompany.Sales<\/h2>/);
    expect(library).toMatch(/Contains<\/span> <span[^>]*>1</);
  });

  it('says where a module is deployed and which library a block is in', () => {
    expect(show(REFUNDS)).toMatch(/Deployed in<\/span> <span[^>]*>1</);
    const block = show(REFUND);
    expect(block).toMatch(/In library<\/span> <span[^>]*>1</);
    // A library's name is one name, never cut at its dots.
    expect(block).toContain('>MyCompany.Sales<');
  });
});

describe('layers and deployment containers', () => {
  const tree = outlineTree(outlineOf(document), []);
  const show = (path: string) =>
    renderToStaticMarkup(
      <MantineProvider>
        <ElementDetail
          node={tree.byPath.get(path)!}
          path={tree
            .ancestryOf(path)
            .map((step) => tree.byPath.get(step))
            .filter((step) => step !== undefined)}
          document={document}
          onSelect={() => {}}
          tree={tree}
        />
      </MantineProvider>,
    );

  it('says what a layer contains and which layer a block is in, apart from its library', () => {
    const layer = show(DOMAIN);
    expect(layer).toMatch(/<h2[^>]*>domain<\/h2>/);
    expect(layer).toMatch(/Contains<\/span> <span[^>]*>1</);
    const block = show(REFUND);
    expect(block).toMatch(/In library<\/span> <span[^>]*>1</);
    expect(block).toMatch(/In layer<\/span> <span[^>]*>1</);
  });

  it('says what a container hosts and where a unit is hosted', () => {
    const container = show(CLUSTER);
    expect(container).toMatch(/<h2[^>]*>Shop cluster<\/h2>/);
    expect(container).toMatch(/Hosts<\/span> <span[^>]*>1</);
    expect(container).toContain('>shop-api<');
    expect(show(API)).toMatch(/Hosted by<\/span> <span[^>]*>1</);
  });
});
