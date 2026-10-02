import { describe, expect, it } from 'bun:test';
import { renderToStaticMarkup } from 'react-dom/server';
import type { DesignDocumentInput } from '#backend/app/design-docs/design-doc.ts';
import { valueOf } from '../src/features/design-docs/design-doc-field';
import { scenariosOf } from '../src/features/design-docs/ui/element-details/body/scenarios-of';
import { ChangeListSection } from '../src/features/design-docs/ui/element-details/body/sections/change-list-section';
import {
  implementerItems,
  ruleItems,
  propertyItems,
} from '../src/features/design-docs/ui/element-details/change-list-items';
import { DesignDocumentContext } from '../src/features/design-docs/ui/element-details/design-document-context';
import { ElementDetail } from '../src/features/design-docs/ui/element-details/element-detail';
import { ElementNavigationContext } from '../src/features/design-docs/ui/element-details/element-navigation';
import { ImplementedByList } from '../src/features/design-docs/ui/element-details/implemented-by-modal';
import { MantineProvider } from '../src/shared/design-system/provider';
import type { OutlineNode } from '../src/shared/ui/model-tree/model-outline.ts';
import { outlineTree } from '../src/shared/ui/model-tree/outline-tree';

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
const human = <const T,>(value: T) => ({ value, author: 'human' as const });
const plain = <const T,>(value: T) => ({ value, author: 'agent' as const });

const document = {
  id: 'doc',
  name: 'Holds',
  description: 'A design.',
  modules: { added: [], removed: [], modified: [] },
  buildingBlocks: {
    added: [
      {
        id: 'building_block|pay.Hold',
        type: plain('aggregate'),
        definition: human(DIAGRAM),
        diagram: plain('stateDiagram-v2\n  Held --> Settled'),
        implements: {
          added: ['building_block|pay.Settleable'],
          removed: ['building_block|pay.Lockable'],
        },
        properties: {
          added: [
            {
              name: 'amount',
              type: plain('building_block|pay.Money'),
              optional: plain(true),
            },
          ],
          removed: [],
          modified: [],
        },
        rules: {
          added: [
            {
              name: 'A hold expires',
              description: plain(''),
              scenarios: {
                added: [
                  {
                    name: 'An unpaid hold lapses',
                    description: plain('The retry window closes.'),
                    given: plain('a hold with no payment'),
                    when: plain('an hour passes'),
                    // Gherkin's word; the fixture is never awaited.
                    // oxlint-disable-next-line unicorn/no-thenable
                    then: plain('the hold is released'), // NOSONAR
                  },
                ],
                removed: [],
                modified: [],
              },
            },
          ],
          removed: [],
          modified: [],
        },
        scenarios: {
          added: [
            {
              name: 'A hold settles',
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
  behaviours: {
    added: [
      {
        id: 'behavior|pay.Hold.place',
        definition: plain('Holds a card for a booking.'),
        input: {
          added: [
            {
              name: 'amount',
              type: plain('building_block|pay.Money'),
              description: plain('What to hold.'),
            },
          ],
        },
        output: { added: [{ type: 'building_block|pay.Hold' }] },
        rules: {
          added: [
            {
              name: 'Only once',
              description: plain('A booking holds one card at a time.'),
            },
          ],
        },
      },
    ],
    removed: ['behavior|pay.Voucher.redeem'],
    modified: [],
  },
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
    patternLabel: 'Aggregate',
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
    path: 'building_block|pay.Hold#rule:A hold expires',
    parentPath: 'building_block|pay.Hold',
    elementId: null,
    kind: 'rule',
    name: 'A hold expires',
    depth: 2,
    change: 'added',
  }),
  node({
    path: 'building_block|pay.Hold#rule:A hold expires#scenario:An unpaid hold lapses',
    parentPath: 'building_block|pay.Hold#rule:A hold expires',
    elementId: null,
    kind: 'scenario',
    name: 'An unpaid hold lapses',
    depth: 3,
    change: 'added',
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
    path: 'behavior|pay.Hold.place',
    parentPath: 'building_block|pay.Hold',
    kind: 'behaviour',
    name: 'place',
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
  node({
    path: 'behavior|pay.Voucher.redeem',
    parentPath: 'building_block|pay.Voucher',
    kind: 'behaviour',
    name: 'redeem',
    depth: 2,
    change: 'removed',
  }),
];

// The app's tree leaves rules and scenarios out as well; the panel still
// reads one given its row, and opens a row the tree has.
const tree = outlineTree(outline, ['property']);
// It leaves properties out; the panel still reads one given it.
const withProperties = outlineTree(outline, []);

const show = (path: string, from = tree) => {
  const selected = from.byPath.get(path)!;
  return renderToStaticMarkup(
    <MantineProvider>
      <ElementDetail
        node={selected}
        path={from
          .ancestryOf(path)
          .map((step) => from.byPath.get(step))
          .filter((step) => step !== undefined)}
        document={document}
        onSelect={() => {}}
        tree={from}
      />
    </MantineProvider>,
  );
};

/** A behaviour the tree has no row for, read on its own. */
const behaviour = () => {
  const place = node({
    path: 'behavior|pay.Hold.place',
    kind: 'behaviour',
    name: 'place',
    change: 'added',
  });
  return renderToStaticMarkup(
    <MantineProvider>
      <ElementDetail
        node={place}
        path={[place]}
        document={document}
        onSelect={() => {}}
        tree={tree}
      />
    </MantineProvider>,
  );
};

describe('ElementDetail', () => {
  it('heads the element a level under the page', () => {
    expect(show('building_block|pay.Hold')).toMatch(/<h2[^>]*>Hold<\/h2>/);
  });

  it('says what a block implements after its name, not in a section', () => {
    const html = show('building_block|pay.Hold');
    expect(html).toMatch(
      /<h2[^>]*>Hold<\/h2><span[^>]*>implements <span[^>]*>Lockable<\/span>, <span[^>]*>Settleable<\/span><\/span>/,
    );
    // What the design removes stays, struck through.
    expect(html).toMatch(/<span[^>]*data-removed="true"[^>]*>Lockable<\/span>/);
    expect(html).not.toContain('>Implements<');
  });

  it('offers what implements a type beside its badges', () => {
    const type = (name: string) =>
      node({
        path: `building_block|pay.${name}`,
        parentPath: 'module|pay',
        kind: 'building_block',
        name,
        depth: 1,
      });
    const withTypes = outlineTree(
      [...outline, type('Settleable'), type('Lockable')],
      ['property'],
    );
    // Found in the document even for a type the design leaves alone.
    expect(show('building_block|pay.Settleable', withTypes)).toMatch(
      /<button[^>]*aria-label="Implemented by 1 element"/,
    );
    // Nothing implements Hold itself, so it has no menu.
    expect(show('building_block|pay.Hold')).not.toContain('Implemented by');
  });

  it('lists each implementer under a filter box, opening its row', () => {
    const items = implementerItems(document, 'building_block|pay.Lockable');
    const html = renderToStaticMarkup(
      <MantineProvider>
        <DesignDocumentContext.Provider value={document}>
          <ElementNavigationContext.Provider
            value={{ has: () => true, select: () => {} }}
          >
            <ImplementedByList items={items} onOpen={() => {}} />
          </ElementNavigationContext.Provider>
        </DesignDocumentContext.Provider>
      </MantineProvider>,
    );
    expect(html).toMatch(/<input[^>]*aria-label="Filter the implementers"/);
    // The design stops Hold implementing Lockable: it stays, struck through.
    expect(html).toMatch(/<button[^>]*>(<[^>]+>)*Hold</);
    expect(html).toMatch(/data-removed="true"[^>]*>Hold</);
    expect(html).toContain('>removed<');
    // Where it sits, after its name.
    expect(html).toMatch(/>Hold<\/span><span[^>]*>pay<\/span>/);
  });

  it("draws a module's building blocks as cards, each opening its row", () => {
    const html = show('module|pay');
    // No title over them: the pattern captions say what they are.
    expect(html).not.toContain('>Building blocks<');
    expect(html).toMatch(/<button[^>]*data-link="true"[^>]*>Hold<\/button>/);
    // Under its pattern, with how many share it, and the icon the tree gives
    // that pattern; the card itself does not say the pattern again.
    expect(html).toMatch(
      /tabler-icon-package-export[^<]*>(<path[^>]*><\/path>)*<\/svg><\/span>Aggregate · 1</,
    );
    expect(html).not.toContain('>Aggregate<');
    expect(html).toContain('tabler-icon-package-export');
    // The first paragraph of its description, and never the diagram's fence.
    expect(html).toContain('Holds a card while a booking settles.');
    expect(html).not.toContain('```mermaid');
    // One the design removes is still a card, struck through.
    expect(html).toMatch(/data-removed="true"[^>]*>Voucher</);
  });

  it('says where in the model the element sits, as a trail back up it', () => {
    const html = show('building_block|pay.Hold#scenario:A hold settles');
    expect(html).toMatch(/<nav[^>]*aria-label="Where this element sits"/);
    expect(html).toContain('>pay<');
    expect(html).toContain('>Hold<');
    // The element itself closes the trail as where the reader is, not as a
    // step of the way to it.
    expect(html).toMatch(/aria-current="location"[^>]*>A hold settles</);
    expect(html.match(/<button[^>]*>/g)).toHaveLength(2);
  });

  it('steps back up the trail with a button, not with an ornament', () => {
    const html = show('building_block|pay.Hold#scenario:A hold settles');
    expect(html).toMatch(/<button[^>]*>(<span[^>]*>)*pay<\/span>/);
    // The separator is drawn, not read out between every pair of steps.
    expect(html).not.toMatch(/Breadcrumbs-separator">&gt;/);
    expect(html).toContain('<span aria-hidden="true">&gt;</span>');
  });

  it('gives a node at the top no step to go back to', () => {
    const html = show('module|pay');
    expect(html).toMatch(/aria-current="location"[^>]*>pay</);
    const trail = html.slice(html.indexOf('<nav'), html.indexOf('</nav>'));
    expect(trail).not.toContain('<button');
  });

  it('gives a definition to the markdown reader, fences and all', () => {
    const html = show('building_block|pay.Hold');
    expect(html).toContain('>Definition<');
    // Printed as it is written, the fence would be in the markup as three
    // backticks and a word; given to the reader, it becomes a picture.
    expect(html).not.toContain('```');
    expect(html).not.toContain('Not specified.');
    expect(html).toContain('by a human');
  });

  it('draws the diagram of an element in a section of its own', () => {
    const html = show('building_block|pay.Hold');
    expect(html).toMatch(/>Diagram<[\s\S]*Drawing diagram…/);
    expect(html).not.toContain('Held --&gt; Settled');
  });

  it('shows no diagram section when the design draws none', () => {
    expect(show('building_block|pay.Hold#rule:A hold expires')).not.toContain(
      '>Diagram<',
    );
  });

  it('says a description is missing rather than opening an editor on it', () => {
    expect(show('building_block|pay.Hold#rule:A hold expires')).toContain(
      'Not specified.',
    );
  });

  it('says a description the design leaves alone is unchanged', () => {
    // The fixture's property carries no description at all: the design keeps
    // whatever the model says, which is not the same as saying nothing.
    const html = show(
      'building_block|pay.Hold#property:amount',
      withProperties,
    );
    expect(html).toContain('>unchanged<');
    expect(html).not.toContain('Not specified.');
  });

  it('reads a property as the field it declares', () => {
    const html = show(
      'building_block|pay.Hold#property:amount',
      withProperties,
    );
    expect(html).toContain('Money');
    expect(html).toContain('amount?');
  });

  it('reads a scenario as the three things it says', () => {
    const html = show('building_block|pay.Hold#scenario:A hold settles');
    expect(html).toContain('Given');
    expect(html).toContain('When');
    expect(html).toContain('Then');
    expect(html).toContain('the hold settles');
  });

  it("reads a rule's own scenario through the rule", () => {
    const html = show(
      'building_block|pay.Hold#rule:A hold expires#scenario:An unpaid hold lapses',
    );
    expect(html).toContain('the hold is released');
    // The trail runs through the rule the scenario belongs to.
    expect(html).toMatch(/<button[^>]*>(<span[^>]*>)*A hold expires<\/span>/);
  });

  it("lists a block's properties and rules, a rule opening its row", () => {
    const html = show('building_block|pay.Hold');
    for (const title of ['Properties', 'Rules'])
      expect(html).toContain(`>${title}<`);
    expect(html).toMatch(/<button[^>]*>(<[^>]+>)*A hold expires</);
    // A property reads as its declaration, name and type apart, and has no
    // row in the tree to open, so it is only text.
    expect(html).toContain('>amount?<');
    // Its type by its last segment, as inputs and outputs read one.
    expect(html).toMatch(/<span[^>]*>Money<\/span>/);
    expect(html).not.toContain('>pay.Money<');
    expect(html).not.toMatch(/<button[^>]*>(<[^>]+>)*amount\?/);
  });

  it("opens a property's type when the tree has a row for it", () => {
    const money = node({
      path: 'building_block|pay.Money',
      parentPath: 'module|pay',
      kind: 'building_block',
      name: 'Money',
      depth: 1,
    });
    const withMoney = outlineTree([...outline, money], ['property']);
    expect(show('building_block|pay.Hold', withMoney)).toMatch(
      /<button[^>]*data-link="true"[^>]*>Money<\/button>/,
    );
  });

  it("reads a property's description under its line, and nothing else's", () => {
    const properties = {
      added: [
        { name: 'amount', description: plain('What the hold keeps.') },
        { name: 'note', description: plain('  ') },
      ],
    };
    const [amount, note] = propertyItems('building_block|pay.Hold', properties);
    expect(amount!.description).toBe('What the hold keeps.');
    expect(note!.description).toBeUndefined();
    const hold = document.buildingBlocks.added[0]!;
    for (const item of ruleItems(hold.id, hold.rules))
      expect(item.description).toBeUndefined();

    const html = renderToStaticMarkup(
      <MantineProvider>
        <ChangeListSection
          element={{ collection: 'buildingBlocks', id: hold.id }}
          title="Properties"
          kind="property"
          items={[amount!, note!]}
        />
      </MantineProvider>,
    );
    expect(html).toMatch(/<span[^>]*>What the hold keeps\.<\/span>/);
  });

  it('points every listed part at the row the tree has for it', () => {
    const hold = document.buildingBlocks.added[0]!;
    const items = ruleItems(hold.id, hold.rules);
    expect(items.length).toBe(1);
    for (const item of items) expect(tree.byPath.has(item.path!)).toBe(true);
    // A property's path is kept, but the tree has no row for it.
    for (const item of propertyItems(hold.id, hold.properties))
      expect(tree.byPath.has(item.path!)).toBe(false);
  });

  it("folds a rule's own scenarios into the column beside it", () => {
    const html = show('building_block|pay.Hold#rule:A hold expires');
    expect(html).toContain('>Scenarios<');
    expect(html).toMatch(/<button[^>]*>(<[^>]+>)*An unpaid hold lapses</);
    const rule = tree.byPath.get(
      'building_block|pay.Hold#rule:A hold expires',
    )!;
    expect(
      scenariosOf(rule, document).map(({ name, rule }) => [name, rule]),
    ).toEqual([['An unpaid hold lapses', undefined]]);
  });

  it("marks each scenario for a rule's count to bring into view", () => {
    const html = show('building_block|pay.Hold');
    expect(html).toContain('data-scenario="0"');
    expect(html).toContain('data-scenario="1"');
  });

  it("folds a block's scenarios, and its rules', into one column", () => {
    const html = show('building_block|pay.Hold');
    expect(html).toContain('>Scenarios<');
    // Each scenario is an accordion control, opened to what it says.
    for (const name of ['A hold settles', 'An unpaid hold lapses'])
      expect(html).toMatch(
        new RegExp(`<button[^>]*aria-expanded[^>]*>(<[^>]+>)*${name}<`),
      );
    // Its own first, then its rules', each with what it says.
    const hold = tree.byPath.get('building_block|pay.Hold')!;
    const entries = scenariosOf(hold, document);
    expect(entries.map(({ name, rule }) => [name, rule])).toEqual([
      ['A hold settles', undefined],
      ['An unpaid hold lapses', 'A hold expires'],
    ]);
    expect(valueOf(entries[1]!.scenario?.then)).toBe('the hold is released');
    // A rule's own scenario says whose it is.
    expect(html).toMatch(/An unpaid hold lapses<.*>A hold expires</);
  });

  it("reads a block's behaviours before its properties", () => {
    const html = show('building_block|pay.Hold');
    expect(html.indexOf('>Behaviours<')).toBeGreaterThan(-1);
    expect(html.indexOf('>Behaviours<')).toBeLessThan(
      html.indexOf('>Properties<'),
    );
  });

  it("reads each of a block's behaviours as a signature", () => {
    const html = show('building_block|pay.Hold');
    expect(html).toContain('>Behaviours<');
    // Its name, which opens its row, then what it takes and gives back.
    expect(html).toMatch(/<button[^>]*>place<\/button>/);
    // Each input its own element, so each can say what its type is.
    expect(html).toMatch(/>\(<\/span><span[^>]*>amount<\/span><span[^>]*>\)</);
    expect(html).toContain('>Hold<');
    expect(html).toContain('Holds a card for a booking.');
    // What each input is for is on the behaviour's own page.
    expect(html).not.toContain('What to hold.');
  });

  it('lists a behaviour the design only removes by its name alone', () => {
    const html = show('building_block|pay.Voucher');
    expect(html).toMatch(/<button[^>]*>(<[^>]+>|<svg.*?<\/svg>)*redeem</);
    expect(html).not.toContain('>Input<');
  });

  it("leaves out a scenario's description when it only repeats its name", () => {
    const echo = {
      ...document,
      buildingBlocks: {
        ...document.buildingBlocks,
        added: [
          {
            ...document.buildingBlocks.added[0]!,
            scenarios: {
              added: [
                {
                  name: 'A hold settles',
                  // The name again, as a sentence: a full stop says no more.
                  description: plain('A hold settles.'),
                  given: plain('a hold'),
                  when: plain('the booking is confirmed'),
                  // Gherkin's word; the fixture is never awaited.
                  // oxlint-disable-next-line unicorn/no-thenable
                  then: plain('the hold settles'), // NOSONAR
                },
              ],
            },
          },
        ],
      },
    } satisfies DesignDocumentInput;
    const hold = tree.byPath.get('building_block|pay.Hold')!;
    // Folded panels are hidden with React's Activity, which leaves them out
    // of the markup; hidden with CSS instead, they can be read.
    const theme = {
      components: {
        Accordion: { defaultProps: { keepMountedMode: 'display-none' } },
      },
    };
    const render = (doc: DesignDocumentInput) =>
      renderToStaticMarkup(
        <MantineProvider theme={theme}>
          <ElementDetail
            node={hold}
            path={[hold]}
            document={doc}
            onSelect={() => {}}
            tree={tree}
          />
        </MantineProvider>,
      );
    const html = render(echo);
    // The panel is there to read...
    expect(html).toContain('the booking is confirmed');
    // ...and the name is in it once, as the control's; not again in the panel.
    expect(html.match(/>A hold settles</g)).toHaveLength(1);
    expect(html).not.toContain('A hold settles.');
    // A description that says more is still read.
    expect(render(document)).toContain('The ordinary path.');
  });

  it('gives an element without scenarios no column for them', () => {
    expect(behaviour()).not.toContain('>Scenarios<');
  });

  it('gives an element the design removes no scenarios', () => {
    const voucher = tree.byPath.get('building_block|pay.Voucher')!;
    expect(scenariosOf(voucher, document)).toEqual([]);
  });

  it("reads a behaviour's input and output as one section", () => {
    const html = behaviour();
    expect(html.match(/>Input \/ Output</g)).toHaveLength(1);
    // Each side a list, named by its caption.
    expect(html).toMatch(/<ul aria-labelledby="[^"]+"/);
    expect(html).toContain('>Inputs · 1<');
    expect(html).toContain('>Outputs · 1<');
    expect(html).toContain('>amount<');
    expect(html).toContain('>Money<');
    expect(html).toContain('What to hold.');
    expect(html).toContain('>Hold<');
  });

  it('points a rule at the scenarios that cover it', () => {
    const html = show('building_block|pay.Hold');
    expect(html).toMatch(/<a href="#element-scenarios"[^>]*>.*?1 scenario</);
    expect(html).toContain('id="element-scenarios"');
  });

  it('folds every scenario until asked, and opens them all at once', () => {
    const html = show('building_block|pay.Hold');
    expect(html).toMatch(/<button[^>]*>(<[^>]+>)*Expand all</);
    expect(html).not.toContain('aria-expanded="true"');
    // Folded, not gone: the panel each control names is in the page.
    const controls = [...html.matchAll(/aria-controls="([^"]+)"/g)];
    expect(controls).toHaveLength(2);
    for (const [, id] of controls)
      expect(html).toMatch(new RegExp(`id="${id}"[^>]*hidden`));
  });

  it('reads each rule by its name and its description', () => {
    const html = behaviour();
    expect(html).toContain('>Rules<');
    expect(html).toContain('>Only once<');
    expect(html).toMatch(
      /<span[^>]*>A booking holds one card at a time\.<\/span>/,
    );
  });

  it('lists what changed under a module the design never names', () => {
    const html = show('module|pay');
    expect(html).toContain('does not change it');
    // Added and removed alike, each opening its row.
    for (const name of ['Hold', 'Voucher'])
      expect(html).toMatch(new RegExp(`<button[^>]*>(<[^>]+>)*${name}<`));
  });

  it('lists an item with no row as text, not as a button', () => {
    const hold = tree.byPath.get('building_block|pay.Hold')!;
    const html = renderToStaticMarkup(
      <MantineProvider>
        <ElementDetail
          node={hold}
          path={[hold]}
          document={document}
          onSelect={() => {}}
          tree={outlineTree([])}
        />
      </MantineProvider>,
    );
    expect(html).toContain('A hold expires');
    // Scenario controls are buttons; the listed rule is not.
    expect(html).not.toMatch(/<button[^>]*>(<[^>]+>)*A hold expires</);
  });

  it('says an element is removed, and lists what went with it', () => {
    const html = show('building_block|pay.Voucher');
    expect(html).toContain('removes it');
    expect(html).toContain('>Behaviours<');
    expect(html).toMatch(/<button[^>]*>(<[^>]+>)*redeem</);
  });

  it('says why an element the design never mentions is in the tree', () => {
    expect(show('module|pay')).toContain('does not change it');
  });
});
