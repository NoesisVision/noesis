import { mock, describe, expect, it } from 'bun:test';
import { renderToStaticMarkup } from 'react-dom/server';
import type { DesignDocumentInput } from '#backend/app/design-docs/design-doc.ts';
import { valueOf } from '../src/features/design-docs/design-doc-field';
import { ElementBody } from '../src/features/design-docs/ui/architecture/element-body';
import { scenariosOf } from '../src/features/design-docs/ui/element-details/body/scenarios-of';
import {
  propertyItems,
  ruleItems,
} from '../src/features/design-docs/ui/element-details/change-list-items';
import { DesignDocumentContext } from '../src/features/design-docs/ui/element-details/design-document-context';
import { ElementDetail } from '../src/features/design-docs/ui/element-details/element-detail';
import { ElementNavigationContext } from '../src/features/design-docs/ui/element-details/element-navigation';
import { ElementRelations } from '../src/features/design-docs/ui/element-details/element-relations';
import type { OutlineNode } from '../src/features/design-docs/ui/model-tree/model-outline.ts';
import { outlineTree } from '../src/features/design-docs/ui/model-tree/outline-tree';
import { MantineProvider } from '../src/shared/design-system/provider';

// The editor that reads markdown arrives on its own and draws its text only
// in a browser: here a description reads as its markdown, so where it lands
// can be asserted.
void mock.module(
  '../src/features/design-docs/ui/element-details/markdown-reading.tsx',
  () => ({
    MarkdownReading: ({ markdown }: { markdown: string }) => (
      <span data-markdown>{markdown}</span>
    ),
  }),
);

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

const PLACE = 'behavior|pay.Hold.place';
const EXPIRES = 'rule|pay.A hold expires';
const ONCE = 'rule|pay.Only once';
const LAPSES = 'scenario|pay.A hold expires.An unpaid hold lapses';
const SETTLES = 'scenario|pay.A hold expires.A hold settles';
const EXPIRES_ROW = `${PLACE}#rule:${EXPIRES}`;
const LAPSES_ROW = `${EXPIRES_ROW}#scenario:${LAPSES}`;
const SETTLES_ROW = `${EXPIRES_ROW}#scenario:${SETTLES}`;

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
      },
    ],
    removed: ['building_block|pay.Voucher'],
    modified: [],
  },
  behaviors: {
    added: [
      {
        id: 'behavior|pay.Hold.place',
        definition: plain('Holds a card for a booking.'),
      },
    ],
    removed: ['behavior|pay.Voucher.redeem'],
    modified: [],
  },
  rules: {
    added: [
      { id: EXPIRES, name: plain('A hold expires'), description: plain('') },
      {
        id: ONCE,
        name: plain('Only once'),
        description: plain('A booking holds one card at a time.'),
      },
    ],
  },
  scenarios: {
    added: [
      {
        id: LAPSES,
        name: plain('An unpaid hold lapses'),
        description: plain('The retry window closes.'),
        steps: plain([
          { kind: 'given', text: 'a hold with no payment' },
          { kind: 'when', text: 'an hour passes' },
          { kind: 'then', text: 'the hold is released' },
        ]),
      },
      {
        id: SETTLES,
        name: plain('A hold settles'),
        description: plain('The ordinary path.'),
        steps: plain([
          { kind: 'given', text: 'a hold' },
          { kind: 'when', text: 'the booking is confirmed' },
          { kind: 'then', text: 'the hold settles' },
        ]),
      },
    ],
  },
  relations: {
    added: [
      { kind: 'governs', from: PLACE, to: EXPIRES },
      { kind: 'governs', from: PLACE, to: ONCE },
      { kind: 'illustrates', from: LAPSES, to: EXPIRES },
      { kind: 'illustrates', from: SETTLES, to: EXPIRES },
      {
        kind: 'extends',
        from: 'building_block|pay.Hold',
        to: 'building_block|pay.Settleable',
      },
      {
        kind: 'has_state',
        from: 'building_block|pay.Hold',
        name: 'amount',
        to: plain('building_block|pay.Money'),
        cardinality: plain('0..1'),
      },
      {
        kind: 'has_collaborator',
        from: 'building_block|pay.Hold',
        name: 'ledger',
        to: plain('building_block|pay.Ledger'),
      },
      {
        kind: 'has_input',
        from: 'behavior|pay.Hold.place',
        name: 'amount',
        to: plain('building_block|pay.Money'),
        cardinality: plain('1'),
        position: plain(1),
      },
      {
        kind: 'has_output',
        from: 'behavior|pay.Hold.place',
        name: 'result',
        to: plain('building_block|pay.Hold'),
        cardinality: plain('1'),
      },
    ],
    removed: [
      {
        kind: 'extends',
        from: 'building_block|pay.Hold',
        to: 'building_block|pay.Lockable',
      },
    ],
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
    pattern: 'Money [0..1]',
    patternLabel: 'Money [0..1]',
  }),
  node({
    path: PLACE,
    parentPath: 'building_block|pay.Hold',
    kind: 'behavior',
    name: 'place',
    depth: 2,
    change: 'added',
  }),
  node({
    path: EXPIRES_ROW,
    parentPath: PLACE,
    elementId: null,
    kind: 'rule',
    name: 'A hold expires',
    depth: 3,
    change: 'added',
  }),
  node({
    path: LAPSES_ROW,
    parentPath: EXPIRES_ROW,
    elementId: null,
    kind: 'scenario',
    name: 'An unpaid hold lapses',
    depth: 4,
    change: 'added',
  }),
  node({
    path: SETTLES_ROW,
    parentPath: EXPIRES_ROW,
    elementId: null,
    kind: 'scenario',
    name: 'A hold settles',
    depth: 4,
    change: 'added',
  }),
  node({
    path: `${PLACE}#rule:${ONCE}`,
    parentPath: PLACE,
    elementId: null,
    kind: 'rule',
    name: 'Only once',
    depth: 3,
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
    kind: 'behavior',
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

/** A behavior the tree has no row for, read on its own. */
const behavior = () => {
  const place = node({
    path: 'behavior|pay.Hold.place',
    kind: 'behavior',
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

  it('says what a block extends over its definition, flat', () => {
    const html = show('building_block|pay.Hold');
    expect(html).toMatch(/<dt[^>]*>(<[^>]+>)*Extends<\/span> <span[^>]*>2</);
    expect(html).toMatch(/>Lockable<[\s\S]*>Settleable</);
    // Not beside the name any more: the name's line holds only its badges.
    const heading = html.slice(html.indexOf('<h2'), html.indexOf('</header>'));
    expect(heading).not.toContain('Lockable');
    // What the design removes stays, struck through.
    expect(html).toMatch(/data-removed="true"[^>]*>(<[^>]+>)*Lockable</);
    // Read flat, with nothing to group them by.
    expect(html).not.toContain('Group by type');
  });

  it('says what extends a type', () => {
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
      /Extended by[\s\S]*<button[^>]*>(<[^>]+>)*Hold</,
    );
    // Nothing implements Hold itself, so it has no such relation.
    expect(show('building_block|pay.Hold')).not.toContain('Implemented by');
  });

  const block = (name: string, pattern: string) =>
    node({
      path: `building_block|pay.${name}`,
      parentPath: 'module|pay',
      kind: 'building_block',
      name,
      pattern,
      depth: 1,
    });
  const relations = (names: [string, string][]) => {
    const tree = outlineTree(
      names.map(([name, pattern]) => block(name, pattern)),
      [],
    );
    const items = names.map(([name]) => ({
      change: 'added' as const,
      label: `pay.${name}`,
      path: `building_block|pay.${name}`,
    }));
    return renderToStaticMarkup(
      <MantineProvider>
        <ElementNavigationContext.Provider
          value={{ has: () => true, select: () => {} }}
        >
          <ElementRelations
            relations={[
              { label: 'Implements', items },
              { label: 'Implemented by', items: [] },
            ]}
            tree={tree}
          />
        </ElementNavigationContext.Provider>
      </MantineProvider>,
    );
  };

  it('names eight types and offers the rest', () => {
    const names = 'ABCDEFGHIJ'
      .split('')
      .map((name): [string, string] => [name, 'value_object']);
    const html = relations(names);
    expect(html).toContain('>H<');
    expect(html).not.toContain('>I<');
    expect(html).toMatch(/<button[^>]*>\+2 more<\/button>/);
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
    const html = show(SETTLES_ROW);
    expect(html).toMatch(/<nav[^>]*aria-label="Where this element sits"/);
    expect(html).toContain('>pay<');
    expect(html).toContain('>Hold<');
    expect(html).toContain('>place<');
    // The element itself closes the trail as where the reader is, not as a
    // step of the way to it.
    expect(html).toMatch(/aria-current="location"[^>]*>A hold settles</);
    expect(html.match(/<button[^>]*>/g)).toHaveLength(4);
  });

  it('steps back up the trail with a button, not with an ornament', () => {
    const html = show(SETTLES_ROW);
    // The step's kind icon, then its name.
    expect(html).toMatch(/<button[^>]*>(<svg[\s\S]*?<\/svg>)<span>pay<\/span>/);
    // The separator is drawn, not read out between every pair of steps.
    expect(html).not.toMatch(/Breadcrumbs-separator">&gt;/);
    expect(html).toMatch(
      /<span aria-hidden="true"><svg[^>]*tabler-icon-chevron-right/,
    );
  });

  it('gives a node at the top no step to go back to', () => {
    const html = show('module|pay');
    expect(html).toMatch(/aria-current="location"[^>]*>pay</);
    const trail = html.slice(html.indexOf('<nav'), html.indexOf('</nav>'));
    expect(trail).not.toContain('<button');
  });

  it('gives a definition to the markdown reader under the name, not a section', () => {
    const html = show('building_block|pay.Hold');
    // Read in the header now; the body has no section for it.
    expect(html).not.toContain('>Definition<');
    // Printed as it is written, the fence would be in the markup as three
    // backticks and a word; given to the reader, it becomes a picture.
    expect(html).not.toContain('```');
  });

  it('draws the diagram of an element in a section of its own', () => {
    const html = show('building_block|pay.Hold');
    expect(html).toMatch(/>Diagram<[\s\S]*Drawing diagram…/);
    expect(html).not.toContain('Held --&gt; Settled');
  });

  it('shows no diagram section when the design draws none', () => {
    expect(show(EXPIRES_ROW)).not.toContain('>Diagram<');
  });

  it('says a description is missing rather than opening an editor on it', () => {
    expect(show(EXPIRES_ROW)).toContain('Not specified.');
  });

  it('reads a property as the field it declares, with how many it holds', () => {
    const html = show(
      'building_block|pay.Hold#property:amount',
      withProperties,
    );
    expect(html).toContain('Money');
    expect(html).toContain('amount:');
    expect(html).toContain('[0..1]');
  });

  it('reads a scenario as the three things it says', () => {
    const html = show(SETTLES_ROW);
    expect(html).toContain('Given');
    expect(html).toContain('When');
    expect(html).toContain('Then');
    expect(html).toContain('the hold settles');
  });

  it('reads a scenario through the rule it illustrates', () => {
    const html = show(LAPSES_ROW);
    expect(html).toContain('the hold is released');
    // The trail runs through the rule the scenario illustrates.
    expect(html).toMatch(
      /<button[^>]*>(<svg[\s\S]*?<\/svg>)<span>A hold expires<\/span>/,
    );
  });

  it("lists a block's properties, and a behavior's rules, a rule opening its row", () => {
    const html = show('building_block|pay.Hold');
    expect(html).toContain('>Properties<');
    // A block governs no rule: its behaviors do.
    expect(html).not.toContain('>Rules<');
    const place = show(PLACE);
    expect(place).toContain('>Rules<');
    expect(place).toMatch(/<button[^>]*>(<[^>]+>)*A hold expires</);
    // A property reads as its declaration, name and type apart, and has no
    // row in the tree to open, so it is only text.
    expect(html).toContain('>amount<');
    // Its type by its last segment, as inputs and outputs read one, and how
    // many of it the property holds after it.
    expect(html).toMatch(/<span[^>]*>Money \[0\.\.1\]<\/span>/);
    expect(html).not.toContain('>pay.Money<');
    expect(html).not.toMatch(/<button[^>]*>(<[^>]+>)*amount</);
  });

  it('lists what a block works with in a section of its own, after its properties, with no count', () => {
    const html = show('building_block|pay.Hold');
    expect(html).toContain('>Collaborators<');
    expect(html.indexOf('>Collaborators<')).toBeGreaterThan(
      html.indexOf('>Properties<'),
    );
    expect(html).toContain('>ledger<');
    expect(html).toMatch(/<span[^>]*>Ledger<\/span>/);
  });

  it('reads a collaborator as the field it declares', () => {
    const html = show(
      'building_block|pay.Hold#collaborator:ledger',
      outlineTree(
        [
          ...outline,
          node({
            path: 'building_block|pay.Hold#collaborator:ledger',
            parentPath: 'building_block|pay.Hold',
            elementId: null,
            kind: 'collaborator',
            name: 'ledger',
            depth: 2,
            change: 'added',
          }),
        ],
        [],
      ),
    );
    expect(html).toContain('ledger:');
    expect(html).toContain('Ledger');
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

  it('points every listed part at the row the tree has for it', () => {
    const hold = document.buildingBlocks.added[0]!;
    const items = ruleItems(document, PLACE);
    expect(items.length).toBe(2);
    for (const item of items) expect(tree.byPath.has(item.path!)).toBe(true);
    // A property's path is kept, but the tree has no row for it.
    for (const item of propertyItems(document, hold.id))
      expect(tree.byPath.has(item.path!)).toBe(false);
  });

  it("folds a rule's scenarios into the column beside it, without its name again", () => {
    const html = show(EXPIRES_ROW);
    expect(html).toContain('>Scenarios<');
    expect(html).toMatch(/<button[^>]*>(<[^>]+>)*An unpaid hold lapses</);
    const rule = tree.byPath.get(EXPIRES_ROW)!;
    expect(
      scenariosOf(rule, document).map(({ name, ruleName }) => [name, ruleName]),
    ).toEqual([
      ['An unpaid hold lapses', undefined],
      ['A hold settles', undefined],
    ]);
  });

  it('gives the architecture view the column its rules point at', () => {
    const html = renderToStaticMarkup(
      <MantineProvider>
        {/* The document and the way on are the architecture details' own. */}
        <DesignDocumentContext.Provider value={document}>
          <ElementNavigationContext.Provider
            value={{
              has: (path: string) => tree.byPath.has(path),
              select: () => {},
            }}
          >
            <ElementBody id={PLACE} document={document} modelTree={tree} />
          </ElementNavigationContext.Provider>
        </DesignDocumentContext.Provider>
      </MantineProvider>,
    );
    expect(html).toContain('href="#element-scenarios"');
    expect(html).toContain('id="element-scenarios"');
    expect(html).toMatch(/<button[^>]*>(<[^>]+>)*An unpaid hold lapses</);
  });

  it("marks each scenario for a rule's count to bring into view", () => {
    const html = show(PLACE);
    expect(html).toContain('data-scenario="0"');
    expect(html).toContain('data-scenario="1"');
  });

  it("folds the scenarios of a behavior's rules into one column", () => {
    const html = show(PLACE);
    expect(html).toContain('>Scenarios<');
    // Each scenario is an accordion control, opened to what it says.
    for (const name of ['A hold settles', 'An unpaid hold lapses'])
      expect(html).toMatch(
        new RegExp(`<button[^>]*aria-expanded[^>]*>(<[^>]+>)*${name}<`),
      );
    // Rule by rule, each with what it says.
    const place = tree.byPath.get(PLACE)!;
    const entries = scenariosOf(place, document);
    expect(entries.map(({ name, ruleName }) => [name, ruleName])).toEqual([
      ['An unpaid hold lapses', 'A hold expires'],
      ['A hold settles', 'A hold expires'],
    ]);
    expect(valueOf(entries[0]!.scenario?.steps)?.at(-1)?.text).toBe(
      'the hold is released',
    );
    // Each says the rule it illustrates.
    expect(html).toMatch(/An unpaid hold lapses<.*>A hold expires</);
  });

  it("reads a block's behaviors before its properties", () => {
    const html = show('building_block|pay.Hold');
    expect(html.indexOf('>Behaviors<')).toBeGreaterThan(-1);
    expect(html.indexOf('>Behaviors<')).toBeLessThan(
      html.indexOf('>Properties<'),
    );
  });

  it("reads each of a block's behaviors as a signature", () => {
    const html = show('building_block|pay.Hold');
    expect(html).toContain('>Behaviors<');
    // Its name, which opens its row, then what it takes and gives back.
    expect(html).toMatch(/<button[^>]*>place<\/button>/);
    // Each input by its name and its type, read short.
    expect(html).toMatch(
      />\(<\/span><span[^>]*>amount: <span[^>]*>Money<\/span><\/span><span[^>]*>\)</,
    );
    // What it gives back opens its type's row, as its name opens its own.
    expect(html).toMatch(/→ <\/span><button[^>]*data-link[^>]*>Hold<\/button>/);
    expect(html).toContain('Holds a card for a booking.');
    // What each input is for is on the behavior's own page.
    expect(html).not.toContain('What to hold.');
  });

  it('lists a behavior the design only removes by its name alone', () => {
    const html = show('building_block|pay.Voucher');
    expect(html).toMatch(/<button[^>]*>(<[^>]+>|<svg.*?<\/svg>)*redeem</);
    expect(html).not.toContain('>Input<');
  });

  it("leaves out a scenario's description when it only repeats its name", () => {
    const echo = {
      ...document,
      scenarios: {
        added: [
          {
            id: SETTLES,
            name: plain('A hold settles'),
            // The name again, as a sentence: a full stop says no more.
            description: plain('A hold settles.'),
            steps: plain([
              { kind: 'given', text: 'a hold' },
              { kind: 'when', text: 'the booking is confirmed' },
              { kind: 'then', text: 'the hold settles' },
            ]),
          },
        ],
      },
    } satisfies DesignDocumentInput;
    const hold = tree.byPath.get(PLACE)!;
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
    expect(show('building_block|pay.Hold')).not.toContain('>Scenarios<');
  });

  it('gives an element the design removes no scenarios', () => {
    const voucher = tree.byPath.get('building_block|pay.Voucher')!;
    expect(scenariosOf(voucher, document)).toEqual([]);
  });

  it("reads a behavior's input and output as one section", () => {
    const html = behavior();
    expect(html.match(/>Input \/ Output</g)).toHaveLength(1);
    // Each side a list, named by its caption.
    expect(html).toMatch(/<ul aria-labelledby="[^"]+"/);
    expect(html).toContain('>Inputs · 1<');
    expect(html).toContain('>Outputs · 1<');
    expect(html).toContain('>amount<');
    expect(html).toContain('>Money<');
    expect(html).toContain('>Hold<');
  });

  it('points a rule at the scenarios that cover it', () => {
    const html = show(PLACE);
    expect(html).toMatch(
      /<a [^>]*href="#element-scenarios"[^>]*>.*?2 scenarios</,
    );
    expect(html).toContain('id="element-scenarios"');
  });

  it('folds every scenario until asked, and opens them all at once', () => {
    const html = show(PLACE);
    expect(html).toMatch(/<button[^>]*>(<[^>]+>)*Expand all</);
    expect(html).not.toContain('aria-expanded="true"');
    // Folded, not gone: the panel each control names is in the page.
    const controls = [...html.matchAll(/aria-controls="([^"]+)"/g)];
    expect(controls).toHaveLength(2);
    for (const [, id] of controls)
      expect(html).toMatch(new RegExp(`id="${id}"[^>]*hidden`));
  });

  it('reads each rule by its name and its description', () => {
    const html = behavior();
    expect(html).toContain('>Rules<');
    expect(html).toContain('>Only once<');
    expect(html).toMatch(
      /<span data-markdown="true">A booking holds one card at a time\.<\/span>/,
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
    const hold = tree.byPath.get(PLACE)!;
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
    expect(html).toContain('>Behaviors<');
    expect(html).toMatch(/<button[^>]*>(<[^>]+>)*redeem</);
  });

  it('says why an element the design never mentions is in the tree', () => {
    expect(show('module|pay')).toContain('does not change it');
  });
});
