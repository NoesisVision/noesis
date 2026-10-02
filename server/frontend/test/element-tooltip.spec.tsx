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
        description: plain('Holds a card. Never shown in a tooltip.'),
        properties: {
          added: [
            {
              name: 'amount',
              type: plain('building_block|pay.Money'),
              optional: plain(true),
              description: plain('What is held.'),
            },
          ],
          removed: ['legacyId'],
        },
      },
    ],
  },
  behaviours: {
    added: [
      {
        id: 'behavior|pay.Hold.place',
        description: plain('Places a hold.'),
        input: {
          added: [{ name: 'amount', type: plain('building_block|pay.Money') }],
        },
        output: { added: [{ type: 'building_block|pay.Hold' }] },
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
    expect(html).toContain('>pay.Hold<');
    expect(html).toContain('>Properties<');
    // The type apart from the name, coloured as a declaration box colours it.
    expect(html).toMatch(/>amount\?: <span[^>]*>Money<\/span>/);
    // What the design removes is not part of what the block is.
    expect(html).not.toContain('legacyId');
  });

  it("lists a behaviour's input and output", () => {
    const html = render('pay.Hold.place');
    expect(html).toContain('>Input<');
    expect(html).toMatch(/>amount: <span[^>]*>Money<\/span>/);
    expect(html).toContain('>Output<');
    // An output is its type alone.
    expect(html).toMatch(/<span[^>]*><span[^>]*>Hold<\/span><\/span>/);
  });

  it('reads a collection by its item', () => {
    expect(render('pay.Hold[]')).toMatch(/>amount\?: <span[^>]*>Money</);
  });

  it('never shows a description', () => {
    const html = render('pay.Hold') + render('pay.Hold.place');
    expect(html).not.toContain('Never shown');
    expect(html).not.toContain('What is held.');
    expect(html).not.toContain('Places a hold.');
  });

  it('gives an element the document does not shape its address alone', () => {
    const html = render('pay.Money');
    expect(html).toContain('>pay.Money<');
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
