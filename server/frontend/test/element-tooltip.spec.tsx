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
      {
        id: 'behavior|pay.Hold.release',
      },
      {
        id: 'behavior|pay.Hold.balance',
      },
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
        kind: 'has_state',
        from: 'building_block|pay.Hold',
        name: 'lines',
        to: plain('building_block|pay.HoldLine'),
        cardinality: plain('*'),
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
        name: 'legacyId',
        to: 'primitive|uuid',
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
    expect(html).toMatch(/>Hold<\/span><\/span><span[^>]*>pay</);
    expect(html).toContain('>Properties<');
    // The type apart from the name, coloured as a declaration box colours
    // it, and marked with how many it holds, as the box marks it.
    expect(html).toMatch(
      />amount: <span[^>]*><span data-cardinality="0\.\.1"(.(?!<\/span>))*tabler-icon-question-mark/,
    );
    expect(html).toMatch(/>optional: <\/span>Money<\/span>/);
    expect(html).toMatch(/>many: <\/span>HoldLine<\/span>/);
    expect(html).not.toMatch(/\[0\.\.1\]|\[\*\]/);
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
    expect(html).toMatch(/>release\(reason: string\)</);
    expect(html).toMatch(/>balance\(\): <span[^>]*>Money<\/span>/);
    // One the design leaves as it is still listed.
    expect(html).toMatch(/>place\(amount: Money\): <span[^>]*>Hold<\/span>/);
  });

  it('marks each behavior with the plain behavior icon and each property with braces', () => {
    const html = render('pay.Hold');
    expect(html).not.toContain('tabler-icon-circle-letter-c');
    expect(html).not.toContain('tabler-icon-circle-letter-q');
    expect(html).toContain('tabler-icon-activity');
    expect(html).toContain('tabler-icon-braces');
  });

  it("lists a module's building blocks with their kind", () => {
    const html = render('pay');
    expect(html).toContain('>Building blocks<');
    expect(html).toMatch(/>Hold: <span[^>]*>aggregate<\/span>/);
  });

  it('reads a slot by its type, whatever it holds', () => {
    expect(render('pay.Hold [*]')).toMatch(
      />Hold<\/span><\/span><span[^>]*>pay</,
    );
  });

  it("reads a behavior's input and output even where the document leaves the behavior alone", () => {
    const doc = {
      ...document,
      behaviors: { added: [] },
    } satisfies DesignDocumentInput;
    const html = render('pay.Hold.place', doc);
    expect(html).toContain('>Input<');
    expect(html).toMatch(/>amount: <span[^>]*>Money<\/span>/);
  });

  it('never shows a definition', () => {
    const html = render('pay.Hold') + render('pay.Hold.place');
    expect(html).not.toContain('Never shown');
    expect(html).not.toContain('Places a hold.');
  });

  it('gives an element the document does not shape its address alone', () => {
    const html = render('pay.Money');
    expect(html).toMatch(/>Money<\/span><\/span><span[^>]*>pay</);
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

  it('says after the name whether a marked slot holds many or is optional, a primitive too', () => {
    const tooltip = (name: string, cardinality: '*' | '0..1') =>
      renderToStaticMarkup(
        <MantineProvider theme={theme}>
          <DesignDocumentContext.Provider value={document}>
            <ElementTooltip name={name} cardinality={cardinality}>
              <span>type</span>
            </ElementTooltip>
          </DesignDocumentContext.Provider>
        </MantineProvider>,
      );
    const many = tooltip('pay.HoldLine', '*');
    // After the name, on its line: the mark and its word, nothing longer.
    expect(many).toMatch(
      />HoldLine<\/span><span[^>]*><span data-cardinality="\*"[^>]*><svg[^>]*tabler-icon-asterisk/,
    );
    expect(many).toMatch(/<\/svg><\/span><span[^>]*>Many<\/span>/);
    expect(many).not.toContain('holds any number');
    const optional = tooltip('string', '0..1');
    expect(optional).toContain('role="tooltip"');
    expect(optional).toMatch(
      />string<\/span><span[^>]*>(<[^>]+>)*<\/svg><\/span><span[^>]*>Optional</,
    );
  });

  it('gives a name with nothing to cut and nothing to say no tooltip', () => {
    const html = render('integer');
    expect(html).not.toContain('role="tooltip"');
    expect(html).toContain('>a whole card<');
  });
});
