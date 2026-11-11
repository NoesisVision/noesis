import { describe, expect, it } from 'bun:test';
import type { DesignDocumentInput } from '#backend/app/design-docs/design-doc.ts';
import {
  descriptionTargets,
  linkedTargets,
  linkedViews,
  readableDescription,
  targetOfHref,
} from '../src/features/design-docs/design-doc-description';

const OFFER = 'building_block|sales.offer.Offer';
const PAGE = 'http://localhost:3000/changes/c/design-docs/d';
const document = {
  needs: { added: [{ id: 'refund-lines' }] },
} as unknown as DesignDocumentInput;
const RULE = 'rule|sales.offer.Paid offers only';
const RULE_ROW = `behavior|sales.offer.Offer.accept#rule:${RULE}`;
const resolve = descriptionTargets(
  (id) => (id === OFFER ? OFFER : id === RULE ? RULE_ROW : null),
  document,
);
const read = (markdown: string) => readableDescription(markdown, resolve, PAGE);
const hrefIn = (markdown: string) =>
  /\]\((\S*) /.exec(read(markdown))?.[1] ?? '';

describe('readableDescription', () => {
  it('turns a link to an element the outline has into a link to its row', () => {
    expect(read(`[Offer](noesis:${OFFER}) changes`)).toBe(
      `[Offer](${PAGE}?view=model&node=building_block%7Csales.offer.Offer "Opens in Model") changes`,
    );
  });

  it('turns a link to a need the design states into a link to the requirements', () => {
    expect(read('[Refund lines](noesis:need|refund-lines)')).toBe(
      `[Refund lines](${PAGE}?view=requirements&entry=need%3Arefund-lines "Opens in Requirements")`,
    );
  });

  it('leaves a link to anything the design has not got as its words', () => {
    expect(read('as [Order](noesis:building_block|sales.Order) does')).toBe(
      'as Order does',
    );
    expect(read('[Gone](noesis:need|gone)')).toBe('Gone');
  });

  it('reads an id with spaces in angle brackets, or percent-encoded, and opens a rule at its row', () => {
    const opened = `[Paid](${PAGE}?view=model&node=${encodeURIComponent(RULE_ROW).replaceAll('%20', '+')} "Opens in Model")`;
    expect(read(`[Paid](<noesis:${RULE}>)`)).toBe(opened);
    expect(read(`[Paid](noesis:${RULE.replaceAll(' ', '%20')})`)).toBe(opened);
    expect(read(`[Paid](noesis:${RULE})`)).toBe(`[Paid](noesis:${RULE})`);
  });

  it('leaves a percent sign that escapes nothing as it is written', () => {
    expect(read('[Odd](noesis:building_block|sales.100%)')).toBe('Odd');
  });

  it('leaves every other link alone', () => {
    const markdown = 'see [the spec](https://example.com/spec)';
    expect(read(markdown)).toBe(markdown);
  });
});

describe('targetOfHref', () => {
  it('reads back where a rewritten link takes the reader', () => {
    expect(targetOfHref(hrefIn(`[Offer](noesis:${OFFER})`), PAGE)).toEqual({
      view: 'model',
      node: OFFER,
    });
    expect(targetOfHref(hrefIn('[R](noesis:need|refund-lines)'), PAGE)).toEqual(
      { view: 'requirements', entry: 'need:refund-lines' },
    );
  });

  it('opens nothing for a link elsewhere', () => {
    expect(
      targetOfHref('https://example.com/?view=model&node=x', PAGE),
    ).toBeNull();
    expect(targetOfHref(`${PAGE}?node=x`, PAGE)).toBeNull();
    expect(
      targetOfHref('http://localhost:3000/changes/c/documents?node=x', PAGE),
    ).toBeNull();
  });
});

describe('linkedViews', () => {
  it('lists the views the links open, in the order of the tabs', () => {
    expect(
      linkedViews(
        `[R](noesis:need|refund-lines) and [Offer](noesis:${OFFER})`,
        resolve,
      ),
    ).toEqual(['model', 'requirements']);
  });

  it('leaves out a link that opens nothing', () => {
    expect(linkedViews('[Gone](noesis:need|gone)', resolve)).toEqual([]);
  });
});

describe('linkedTargets', () => {
  it('lists each place once, under the words first used for it', () => {
    expect(
      linkedTargets(
        `[Offer](noesis:${OFFER}), [R](noesis:need|refund-lines), [the offer](noesis:${OFFER})`,
        resolve,
      ),
    ).toEqual([
      { label: 'Offer', target: { view: 'model', node: OFFER } },
      {
        label: 'R',
        target: { view: 'requirements', entry: expect.any(String) },
      },
    ]);
  });

  it('leaves out a link that opens nothing', () => {
    expect(linkedTargets('[Gone](noesis:need|gone)', resolve)).toEqual([]);
  });
});
