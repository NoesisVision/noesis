import { describe, expect, it } from 'bun:test';
import { renderToStaticMarkup } from 'react-dom/server';
import { outlineOf } from '../src/features/design-docs/design-doc-outline';
import { ElementDetail } from '../src/features/design-docs/ui/element-details/element-detail';
import { outlineTree } from '../src/features/design-docs/ui/model-tree/outline-tree';
import { MantineProvider } from '../src/shared/design-system/provider';
import {
  changedEverywhereFixture,
  NOT_EXCEEDING,
  PAID_ONLY,
  WITHIN_A_SECOND,
} from './fixtures/design-doc-outline.fixture';

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

const ISSUE = 'behavior|sales.refunds.Refund.issue';
const GOVERNED = `${ISSUE}#rule:${NOT_EXCEEDING}`;
const DECISION = `${ISSUE}#rule:${PAID_ONLY}`;
const MODULE = 'module|sales.refunds';
const MODULE_RULE = `${MODULE}#rule:${WITHIN_A_SECOND}`;

describe('A rule in the details panel', () => {
  it('says its kind, the behaviors that govern it and the needs it answers, by name', () => {
    const html = show(GOVERNED);
    expect(html).toMatch(/<dt[^>]*>Kind<\/dt><dd[^>]*>Validation<\/dd>/);
    expect(html).toMatch(
      /<dt[^>]*>Governed by<\/dt><dd[^>]*><ul[^>]*><li[^>]*>(?:<[^>]+>)*Refund\.issue(?:<\/[^>]+>)*<\/li>/,
    );
    expect(html).toMatch(
      /<dt[^>]*>Needs<\/dt><dd[^>]*><ul[^>]*><li[^>]*>(?:<[^>]+>)*Refund single lines(?:<\/[^>]+>)*<\/li>/,
    );
  });

  it('reads its rationale, when the design gives one', () => {
    const html = show(GOVERNED);
    // The markdown reader draws the text itself once mounted.
    // A human wrote it: the section's title is marked so.
    expect(html).toMatch(/data-written-by="human"[^>]*>Rationale</);
    expect(show(MODULE_RULE)).not.toContain('>Rationale<');
  });

  it('marks a rule no need asks for as a design decision', () => {
    expect(show(DECISION)).toMatch(
      /<dt[^>]*>Needs<\/dt><dd[^>]*>Design decision/,
    );
  });

  it('says unchanged for what the design leaves as it is', () => {
    const html = renderToStaticMarkup(
      <MantineProvider>
        <ElementDetail
          node={tree.byPath.get(MODULE_RULE)!}
          path={[tree.byPath.get(MODULE_RULE)!]}
          document={{
            ...changedEverywhereFixture,
            rules: { modified: [{ id: WITHIN_A_SECOND }] },
          }}
          onSelect={() => {}}
          tree={tree}
        />
      </MantineProvider>,
    );
    expect(html).toMatch(/<dt[^>]*>Kind<\/dt><dd[^>]*>unchanged<\/dd>/);
    expect(html).toMatch(/<dt[^>]*>Governed by<\/dt><dd[^>]*>unchanged<\/dd>/);
    expect(html).toMatch(/<dt[^>]*>Needs<\/dt><dd[^>]*>unchanged<\/dd>/);
  });
});

describe('The rules an element lists', () => {
  it('card each rule a behavior governs with its kind, and the needs it answers', () => {
    const html = show(ISSUE);
    expect(html).toContain('>Validation<');
    expect(html).toContain('>Answers Refund single lines<');
  });

  it('card a design decision as one', () => {
    expect(show(ISSUE)).toContain('>Design decision<');
  });

  it('list no rules on a building block', () => {
    expect(show('building_block|sales.refunds.Refund')).not.toContain(
      '>Rules<',
    );
  });

  it('include, on a module, the rules the design names no behavior of', () => {
    const html = show(MODULE);
    expect(html).toContain('>Rules<');
    expect(html).toContain('A refund is issued within a second');
    expect(html).toContain('>Configuration<');
  });

  it("open a module's rule in the panel", () => {
    expect(show(MODULE_RULE)).toMatch(
      /<dt[^>]*>Kind<\/dt><dd[^>]*>Configuration<\/dd>/,
    );
  });
});
