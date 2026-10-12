import { describe, expect, it } from 'bun:test';
import type { DesignDocumentInput } from '#backend/app/design-docs/design-doc.ts';
import {
  descriptionTargets,
  linkedViews,
  readableDescription,
  targetOfHref,
} from '../src/features/design-docs/design-doc-description';

const OFFER = 'building_block|sales.offer.Offer';
const PAGE = 'http://localhost:3000/changes/c/design-docs/d';
const document = {
  needs: { added: [{ id: 'refund-lines' }] },
} as unknown as DesignDocumentInput;
const resolve = descriptionTargets((path) => path === OFFER, document);
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
