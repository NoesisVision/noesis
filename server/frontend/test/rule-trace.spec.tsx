import { describe, expect, it } from 'bun:test';
import { renderToStaticMarkup } from 'react-dom/server';
import { outlineOf } from '../src/features/design-docs/design-doc-outline';
import { ElementDetail } from '../src/features/design-docs/ui/element-details/element-detail';
import { MantineProvider } from '../src/shared/design-system/provider';
import { outlineTree } from '../src/shared/ui/model-tree/outline-tree';
import { changedEverywhereFixture } from './fixtures/design-doc-outline.fixture';

const tree = outlineTree(outlineOf(changedEverywhereFixture), []);

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
        document={changedEverywhereFixture}
        onSelect={() => {}}
        tree={tree}
      />
    </MantineProvider>,
  );
};

const REFUND = 'building_block|sales.refunds.Refund';
const BLOCK_RULE = `${REFUND}#rule:Refund never exceeds paid amount`;
const DECISION =
  'behavior|sales.refunds.Refund.issue#rule:Only paid orders are refundable';
const MODULE = 'module|sales.refunds';
const MODULE_RULE = `${MODULE}#rule:A refund is issued within a second`;

describe('A rule in the details panel', () => {
  it('says its category, its type and the needs it answers, by name', () => {
    const html = show(BLOCK_RULE);
    expect(html).toMatch(/<dt>Category<\/dt><dd>Business<\/dd>/);
    expect(html).toMatch(/<dt>Type<\/dt><dd>Consistency<\/dd>/);
    expect(html).toMatch(
      /<dt>Needs<\/dt><dd><ul[^>]*><li>Refund single lines<\/li>/,
    );
  });

  it('reads its rationale, when the design gives one', () => {
    const html = show(BLOCK_RULE);
    // The markdown reader draws the text itself once mounted.
    expect(html).toMatch(/>Rationale<[\s\S]*Written by a human/);
    expect(show(MODULE_RULE)).not.toContain('>Rationale<');
  });

  it('marks a rule no need asks for as a design decision', () => {
    expect(show(DECISION)).toMatch(/<dt>Needs<\/dt><dd>Design decision/);
  });

  it('says unchanged for what the design leaves as it is', () => {
    const html = renderToStaticMarkup(
      <MantineProvider>
        <ElementDetail
          node={tree.byPath.get(MODULE_RULE)!}
          path={[tree.byPath.get(MODULE_RULE)!]}
          document={{
            ...changedEverywhereFixture,
            modules: {
              added: [
                {
                  id: MODULE,
                  rules: {
                    added: [{ name: 'A refund is issued within a second' }],
                  },
                },
              ],
            },
          }}
          onSelect={() => {}}
          tree={tree}
        />
      </MantineProvider>,
    );
    expect(html).toMatch(/<dt>Category<\/dt><dd>unchanged<\/dd>/);
    expect(html).toMatch(/<dt>Needs<\/dt><dd>unchanged<\/dd>/);
  });
});

describe('The rules an element lists', () => {
  it('card each rule with its category and type, and the needs it answers', () => {
    const html = show(REFUND);
    expect(html).toContain('>Business · Consistency<');
    expect(html).toContain('>Answers Refund single lines<');
  });

  it('card a design decision as one', () => {
    expect(show('behavior|sales.refunds.Refund.issue')).toContain(
      '>Design decision<',
    );
  });

  it("include a module's own rules", () => {
    const html = show(MODULE);
    expect(html).toContain('>Rules<');
    expect(html).toContain('A refund is issued within a second');
    expect(html).toContain('>Quality · Performance<');
  });

  it("open a module's rule in the panel", () => {
    const html = show(MODULE_RULE);
    expect(html).toMatch(/<dt>Category<\/dt><dd>Quality<\/dd>/);
    expect(html).toMatch(/<dt>Type<\/dt><dd>Performance<\/dd>/);
  });
});
