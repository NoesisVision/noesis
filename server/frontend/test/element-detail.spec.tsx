import { describe, expect, it } from 'bun:test';
import { renderToStaticMarkup } from 'react-dom/server';
import type { DesignDocumentInput } from '#backend/app/design-docs/design-doc.ts';
import type { OutlineNode } from '#backend/app/model-outline/model-outline.ts';
import { ElementDetail } from '../src/features/design-docs/ui/element-detail';
import { MantineProvider } from '../src/shared/design-system/provider';
import { outlineTree } from '../src/shared/ui/outline-tree';

const DIAGRAM = [
  'Holds a card while a booking settles.',
  '',
  '```mermaid',
  'flowchart TD',
  '  accTitle: How a hold settles',
  '  A[Hold] --> B[Settled]',
  '```',
].join('\n');

// The trailing comma is what tells a .tsx file this is a type parameter.
const reviewed = <const T,>(value: T) => ({ value, reviewedByHuman: true });
const plain = <const T,>(value: T) => ({ value, reviewedByHuman: false });

const document = {
  id: 'doc',
  name: reviewed('Holds'),
  description: plain('A design.'),
  modules: { added: [], removed: [], modified: [] },
  buildingBlocks: {
    added: [
      {
        id: 'building_block|pay.Hold',
        type: plain('aggregate'),
        description: reviewed(DIAGRAM),
        properties: {
          added: [
            {
              name: plain('amount'),
              type: plain('Money'),
              description: plain(null),
              nullable: true,
            },
          ],
          removed: [],
          modified: [],
        },
        rules: { added: [], removed: [], modified: [] },
        scenarios: {
          added: [
            {
              name: plain('A hold settles'),
              description: plain('The ordinary path.'),
              given: plain('a hold'),
              when: plain('the booking is confirmed'),
              // Gherkin's word; the fixture is never awaited.
              // oxlint-disable-next-line unicorn/no-thenable
              then: plain('the hold settles'), // NOSONAR
            },
          ],
          removed: [],
          modified: [],
        },
      },
    ],
    removed: ['building_block|pay.Voucher'],
    modified: [],
  },
  behaviours: { added: [], removed: [], modified: [] },
  implemented: false,
} satisfies DesignDocumentInput;

const node = (over: Partial<OutlineNode> & Pick<OutlineNode, 'path'>) =>
  ({
    parentPath: null,
    elementId: over.path,
    kind: 'module',
    name: over.path,
    depth: 0,
    change: 'unchanged',
    pattern: null,
    patternLabel: null,
    hasDiagram: false,
    ...over,
  }) satisfies OutlineNode;

const outline: OutlineNode[] = [
  node({ path: 'module|pay', name: 'pay' }),
  node({
    path: 'building_block|pay.Hold',
    parentPath: 'module|pay',
    kind: 'building_block',
    name: 'Hold',
    depth: 1,
    change: 'added',
    pattern: 'aggregate',
    patternLabel: 'aggregate',
    hasDiagram: true,
  }),
  node({
    path: 'building_block|pay.Hold#property:amount',
    parentPath: 'building_block|pay.Hold',
    elementId: null,
    kind: 'property',
    name: 'amount',
    depth: 2,
    change: 'added',
    pattern: 'Money',
    patternLabel: 'Money',
  }),
  node({
    path: 'building_block|pay.Hold#scenario:A hold settles',
    parentPath: 'building_block|pay.Hold',
    elementId: null,
    kind: 'scenario',
    name: 'A hold settles',
    depth: 2,
    change: 'added',
  }),
  node({
    path: 'building_block|pay.Voucher',
    parentPath: 'module|pay',
    kind: 'building_block',
    name: 'Voucher',
    depth: 1,
    change: 'removed',
  }),
];

const tree = outlineTree(outline);

const show = (path: string) => {
  const selected = tree.byPath.get(path)!;
  return renderToStaticMarkup(
    <MantineProvider>
      <ElementDetail
        node={selected}
        path={tree
          .ancestryOf(path)
          .map((step) => tree.byPath.get(step))
          .filter((step) => step !== undefined)}
        document={document}
      />
    </MantineProvider>,
  );
};

describe('ElementDetail', () => {
  it('heads the element a level under the page', () => {
    expect(show('building_block|pay.Hold')).toMatch(/<h2[^>]*>Hold<\/h2>/);
  });

  it('says where in the model the element sits, without naming it twice', () => {
    const html = show('building_block|pay.Hold#property:amount');
    expect(html).toContain('pay');
    expect(html).toContain('Hold');
    expect(html.match(/›/g)).toHaveLength(1);
  });

  it('says nothing about the path of a node at the top', () => {
    expect(show('module|pay')).not.toContain('›');
  });

  it('gives a description to the markdown reader, fences and all', () => {
    const html = show('building_block|pay.Hold');
    // Printed as it is written, the fence would be in the markup as three
    // backticks and a word; given to the reader, it becomes a picture.
    expect(html).not.toContain('```');
    expect(html).not.toContain('Not specified.');
    expect(html).toContain('reviewed');
  });

  it('says a description is missing rather than opening an editor on it', () => {
    expect(show('building_block|pay.Hold#property:amount')).toContain(
      'Not specified.',
    );
  });

  it('reads a property as the field it declares', () => {
    expect(show('building_block|pay.Hold#property:amount')).toContain('Money');
    expect(show('building_block|pay.Hold#property:amount')).toContain('null');
  });

  it('reads a scenario as the three things it says', () => {
    const html = show('building_block|pay.Hold#scenario:A hold settles');
    expect(html).toContain('Given');
    expect(html).toContain('When');
    expect(html).toContain('Then');
    expect(html).toContain('the hold settles');
  });

  it('has nothing to read about an element the design only removes', () => {
    const html = show('building_block|pay.Voucher');
    expect(html).toContain('removes it');
    expect(html).toContain('removed');
  });

  it('says why an element the design never mentions is in the tree', () => {
    expect(show('module|pay')).toContain('does not change it');
  });
});
