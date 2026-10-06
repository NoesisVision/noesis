/*
 * A design document's description names elements of the model by link:
 * `[Offer](noesis:building_block|sales.offer.Offer)`. The link says which
 * element and nothing about where it is; whether it opens anything is decided
 * here, as the description is read, against the outline beside it. So a link
 * written today to an element the outline has not got starts working, with no
 * change to the description, once the page learns to show such elements.
 */

const ELEMENT_LINK = /\[([^\]]*)\]\(noesis:([^)\s]+)\)/g;
const NODE_PARAM = 'node';

/**
 * The description as the page at `page` renders it: a link to an element the
 * outline has becomes a link to that element on the page, one to an element
 * it has not got is left as its words. The link is absolute, since the editor
 * that renders it reads anything else as a web address missing its scheme.
 */
export const readableDescription = (
  markdown: string,
  has: (elementId: string) => boolean,
  page: string,
): string =>
  markdown.replaceAll(ELEMENT_LINK, (_, label: string, elementId: string) =>
    has(elementId) ? `[${label}](${elementHref(page, elementId)})` : label,
  );

/** The element a link written by `readableDescription` for `page` opens, else null. */
export function elementOfHref(href: string, page: string): string | null {
  const url = new URL(href, page);
  const here = new URL(page);
  if (url.origin !== here.origin || url.pathname !== here.pathname) return null;
  return url.searchParams.get(NODE_PARAM);
}

function elementHref(page: string, elementId: string): string {
  const url = new URL(page);
  url.search = new URLSearchParams({ [NODE_PARAM]: elementId }).toString();
  url.hash = '';
  return url.href;
}
