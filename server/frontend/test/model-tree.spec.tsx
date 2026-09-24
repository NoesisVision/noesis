import { describe, expect, it } from 'bun:test';
import { renderToStaticMarkup } from 'react-dom/server';
import type { OutlineNode } from '#backend/app/model-outline/model-outline.ts';
import { MantineProvider } from '../src/shared/design-system/provider';
import { ModelTree } from '../src/shared/ui/model-tree';
import { searchOutline } from '../src/shared/ui/outline-search';
import { outlineTree } from '../src/shared/ui/outline-tree';
import {
  type ModelTreeController,
  useModelTree,
} from '../src/shared/ui/use-model-tree';
import { outlineFixture } from './fixtures/outline.fixture';

/*
 * The tree states its own shape in the markup: the level, the kind and
 * whether a row is open are attributes, because a rail drawn in CSS is
 * invisible to `bun test` and to a screen reader alike.
 */
const nothing = () => {};

function Harness({ nodes }: { nodes: OutlineNode[] }) {
  const controller = useModelTree(nodes, {
    selected: nodes[0]?.path ?? null,
    onSelect: nothing,
    query: '',
    onQuery: nothing,
  });
  return <ModelTree controller={controller} label="Design outline" />;
}

const html = renderToStaticMarkup(
  <MantineProvider>
    <Harness nodes={outlineFixture} />
  </MantineProvider>,
);

const count = (pattern: RegExp) => html.match(pattern)?.length ?? 0;
const rowOf = (name: string) =>
  html
    .split('<li')
    .find(
      (chunk) =>
        chunk.includes(`>${name}</span>`) && chunk.includes('role="treeitem"'),
    );

describe('ModelTree', () => {
  it('is one named tree', () => {
    expect(count(/role="tree"/g)).toBe(1);
    expect(html).toContain('aria-label="Design outline"');
  });

  it('draws the modules and the blocks they hold, and no deeper', () => {
    // Five rows: the context, its two modules, and the two blocks in one of
    // them. A block's own contents wait to be asked for.
    expect(count(/role="treeitem"/g)).toBe(5);
    expect(html).toContain('>Orders<');
    expect(html).not.toContain('>place<');
  });

  it('states the level of every row', () => {
    expect(rowOf('shop')).toContain('aria-level="1"');
    expect(rowOf('orders')).toContain('aria-level="2"');
    expect(rowOf('Order')).toContain('aria-level="3"');
    expect(rowOf('Order')).toContain('data-depth="2"');
  });

  it('says which rows are open, which are shut, and which are neither', () => {
    expect(rowOf('shop')).toContain('aria-expanded="true"');
    expect(rowOf('Order')).toContain('aria-expanded="false"');
    // Nothing is under it, so it is not a thing that opens.
    expect(rowOf('legacy')).not.toContain('aria-expanded');
  });

  it('owns its subtrees, so the levels nest rather than merely indent', () => {
    expect(count(/role="group"/g)).toBe(2);
  });

  it('selects the top of the tree, and gives that row the only tab stop', () => {
    expect(count(/aria-selected="true"/g)).toBe(1);
    expect(rowOf('shop')).toContain('aria-selected="true"');
    expect(count(/tabindex="0"/g)).toBe(1);
  });

  it('says what changed in a word, never in a colour alone', () => {
    expect(rowOf('orders')).toContain('added');
    expect(rowOf('legacy')).toContain('removed');
    expect(rowOf('Order')).toContain('modified');
    // Nothing happened to the context, so nothing is claimed about it.
    expect(rowOf('shop')).not.toContain('data-change="added"');
    expect(rowOf('shop')).toContain('data-change="unchanged"');
  });

  it('names the kind and the pattern of a row', () => {
    expect(rowOf('Order')).toContain('data-kind="building_block"');
    expect(rowOf('Order')).toContain('aggregate');
    expect(rowOf('Orders')).toContain('repository');
  });

  it('marks a row that draws a diagram, in a word as well as a glyph', () => {
    expect(rowOf('Order')).toContain('has a diagram');
    expect(rowOf('Orders')).not.toContain('has a diagram');
  });

  it('lights the rail down to the selected row', () => {
    expect(count(/data-in-path/g)).toBe(1);
  });
});

/*
 * A controller is a plain object, so a search can be put in front of the tree
 * without driving a keyboard that `bun test` does not have.
 */
function searching(query: string): ModelTreeController {
  const tree = outlineTree(outlineFixture);
  const search = searchOutline(tree, query);
  return {
    tree,
    selected: null,
    selectedNode: null,
    query,
    search,
    ask: nothing,
    isExpanded: (path) => search.opened.has(path),
    isVisible: (path) => search.visible === null || search.visible.has(path),
    open: nothing,
    select: nothing,
    expand: nothing,
    collapse: nothing,
    expandAll: nothing,
    collapseAll: nothing,
  };
}

const searched = renderToStaticMarkup(
  <MantineProvider>
    <ModelTree controller={searching('total')} label="Design outline" />
  </MantineProvider>,
);

describe('ModelTree, searching', () => {
  it('draws the match and the line down to it, and nothing else', () => {
    expect(searched.match(/role="treeitem"/g)?.length).toBe(4);
    expect(searched).toContain('>total<');
    expect(searched).not.toContain('>legacy<');
    expect(searched).not.toContain('>Orders<');
  });

  it('opens the way down to the match without opening the match', () => {
    expect(searched).toContain('aria-expanded="true"');
    expect(searched).not.toContain('aria-expanded="false"');
  });

  it('marks what was found, in the markup and not only in a colour', () => {
    expect(searched).toMatch(/<mark[^>]*>total<\/mark>/);
  });

  it('says which rows are only there to hold the match', () => {
    expect(searched.match(/data-context/g)?.length).toBe(3);
  });
});
