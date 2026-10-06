import { describe, expect, it } from 'bun:test';
import {
  elementOfHref,
  readableDescription,
} from '../src/features/design-docs/design-doc-description';

const OFFER = 'building_block|sales.offer.Offer';
const has = (id: string) => id === OFFER;
const PAGE = 'http://localhost:3000/changes/c/design-docs/d';

describe('readableDescription', () => {
  it('turns a link to an element the outline has into a link to its place', () => {
    const markdown = readableDescription(
      `[Offer](noesis:${OFFER}) changes`,
      has,
      PAGE,
    );
    expect(markdown).toBe(
      `[Offer](${PAGE}?node=building_block%7Csales.offer.Offer) changes`,
    );
  });

  it('leaves a link to an element the outline has not got as its words', () => {
    expect(
      readableDescription(
        'as [Order](noesis:building_block|sales.Order) does',
        has,
        PAGE,
      ),
    ).toBe('as Order does');
  });

  it('leaves every other link alone', () => {
    const markdown = 'see [the spec](https://example.com/spec)';
    expect(readableDescription(markdown, has, PAGE)).toBe(markdown);
  });
});

describe('elementOfHref', () => {
  it('reads back the element a rewritten link opens', () => {
    const markdown = readableDescription(`[Offer](noesis:${OFFER})`, has, PAGE);
    const href = /\((.*)\)/.exec(markdown)?.[1] ?? '';
    expect(elementOfHref(href, PAGE)).toBe(OFFER);
  });

  it('opens nothing for a link elsewhere', () => {
    expect(elementOfHref('https://example.com/?node=x', PAGE)).toBeNull();
    expect(
      elementOfHref('http://localhost:3000/changes/c/documents?node=x', PAGE),
    ).toBeNull();
  });
});
