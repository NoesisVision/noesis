import { describe, expect, it } from 'bun:test';
import { renderToStaticMarkup } from 'react-dom/server';
import type { DesignDocumentInput } from '#backend/app/design-docs/design-doc.ts';
import { DesignDocumentContext } from '../src/features/design-docs/ui/element-details/design-document-context';
import { ElementTooltip } from '../src/features/design-docs/ui/element-details/element-tooltip';
import { MantineProvider } from '../src/shared/design-system/provider';

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
        definition: plain('Holds a card. Never shown in a tooltip.'),
      },
    ],
  },
  behaviors: {
    added: [
      {
        id: 'behavior|pay.Hold.place',
        definition: plain('Places a hold.'),
      },
      { id: 'behavior|pay.Hold.release' },
      { id: 'behavior|pay.Hold.balance' },
    ],
  },
  relations: {
    added: [
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
      {
        kind: 'has_input',
        from: 'behavior|pay.Hold.release',
        name: 'reason',
        to: plain('primitive|string'),
        cardinality: plain('1'),
        position: plain(2),
      },
      // Listed after the reason, yet first in the signature.
      {
        kind: 'has_input',
        from: 'behavior|pay.Hold.release',
        name: 'by',
        to: plain('primitive|string'),
        cardinality: plain('1'),
        position: plain(1),
      },
      {
        kind: 'has_output',
        from: 'behavior|pay.Hold.balance',
        name: 'result',
        to: plain('building_block|pay.Money'),
        cardinality: plain('1'),
      },
    ],
    removed: [
      {
        kind: 'has_state',
        from: 'building_block|pay.Hold',
        to: 'primitive|uuid',
        name: 'legacyId',
      },
    ],
  },
  implemented: false,
} satisfies DesignDocumentInput;

// Every tooltip open and drawn in place, so its label is in the markup.
const theme = {
  components: {
    Tooltip: { defaultProps: { opened: true, withinPortal: false } },
  },
};

const render = (name: string, doc: DesignDocumentInput | null = document) =>
  renderToStaticMarkup(
    <MantineProvider theme={theme}>
      <DesignDocumentContext.Provider value={doc}>
        <ElementTooltip name={name}>
          <div className="target">a whole card</div>
        </ElementTooltip>
      </DesignDocumentContext.Provider>
    </MantineProvider>,
  );

describe('ElementTooltip', () => {
  it("lists a block's properties under its full address", () => {
    const html = render('hold: pay.Hold');
    // Over the element it is given, not a name of its own.
    expect(html).toMatch(/<div class="target[^"]*"[^>]*>a whole card<\/div>/);
    // Its name, then where it sits under it.
    expect(html).toMatch(/>Hold<\/span><span[^>]*>pay</);
    expect(html).toContain('>Properties<');
    // The type apart from the name, coloured as a declaration box colours it.
    expect(html).toMatch(/>amount: <span[^>]*>Money \[0\.\.1\]<\/span>/);
    // What the design removes is not part of what the block is.
    expect(html).not.toContain('legacyId');
  });

  it("lists a behavior's input and output", () => {
    const html = render('pay.Hold.place');
    expect(html).toContain('>Input<');
    expect(html).toMatch(/>amount: <span[^>]*>Money<\/span>/);
    expect(html).toContain('>Output<');
    // An output is its type alone.
    expect(html).toMatch(/<span[^>]*><span[^>]*>Hold<\/span><\/span>/);
  });

  it("lists a block's behaviors as signatures, over its properties", () => {
    const html = render('pay.Hold');
    expect(html.indexOf('>Behaviors<')).toBeLessThan(
      html.indexOf('>Properties<'),
    );
    // Its parameters in the order of their positions, not of the document.
    expect(html).toMatch(/>release\(by: string, reason: string\)</);
    expect(html).toMatch(/>balance\(\): <span[^>]*>Money<\/span>/);
    // One whose kind the design leaves as it is still listed.
    expect(html).toMatch(/>place\(amount: Money\): <span[^>]*>Hold<\/span>/);
  });

  it('marks each behavior as one, each property with braces and each collaborator with arrows', () => {
    const html = render('pay.Hold');
    expect(html).toContain('tabler-icon-activity');
    expect(html).not.toContain('tabler-icon-circle-letter-c');
    expect(html).toContain('tabler-icon-braces');
    expect(html).toContain('>Collaborators<');
    expect(html).toContain('tabler-icon-arrows-left-right');
    expect(html).toMatch(/>ledger: <span[^>]*>Ledger/);
  });

  it("lists a module's building blocks with their kind", () => {
    const html = render('pay');
    expect(html).toContain('>Building blocks<');
    expect(html).toMatch(/>Hold: <span[^>]*>aggregate<\/span>/);
  });

  it('reads a slot by its type, however many it holds', () => {
    expect(render('pay.Hold [0..*]')).toMatch(/>amount: <span[^>]*>Money/);
  });

  it('never shows a definition or a description', () => {
    const html = render('pay.Hold') + render('pay.Hold.place');
    expect(html).not.toContain('Never shown');
    expect(html).not.toContain('What is held.');
    expect(html).not.toContain('Places a hold.');
  });

  it('gives an element the document does not shape its address alone', () => {
    const html = render('pay.Money');
    expect(html).toMatch(/>Money<\/span><span[^>]*>pay</);
    expect(html).not.toContain('>Properties<');
  });

  it("gives an input shown by its name its type, a primitive's too", () => {
    const html = renderToStaticMarkup(
      <MantineProvider theme={theme}>
        <DesignDocumentContext.Provider value={document}>
          <ElementTooltip name="count: integer" shown="count">
            <span>count</span>
          </ElementTooltip>
        </DesignDocumentContext.Provider>
      </MantineProvider>,
    );
    expect(html).toContain('role="tooltip"');
    expect(html).toContain('>integer<');
  });

  it('gives a name with nothing to cut and nothing to say no tooltip', () => {
    const html = render('integer');
    expect(html).not.toContain('role="tooltip"');
    expect(html).toContain('>a whole card<');
  });
});
