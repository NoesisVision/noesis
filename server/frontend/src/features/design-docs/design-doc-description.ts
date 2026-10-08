import type { DesignDocumentInput } from '#backend/app/design-docs/design-doc.ts';
import { findById } from './change-set.ts';
import { needPath } from './design-doc-requirements.ts';

/*
 * A design document's description names what it is about by link: an element
 * of the model, `[Offer](noesis:building_block|sales.offer.Offer)`, or a need,
 * `[Start a QDoc](noesis:need|start-a-qdoc)`. The link says which and nothing
 * about where it is; whether it opens anything is decided here, as the
 * description is read. So a link written today to an element the outline has
 * not got starts working, with no change to the description, once the page
 * learns to show such elements.
 */

const DESCRIPTION_LINK = /\[([^\]]*)\]\(noesis:([^)\s]+)\)/g;
const NEED = 'need|';

/** Where a link in the description takes the reader: a row of the model, or an entry of the requirements. */
export type DescriptionTarget =
  | { view: 'model'; node: string }
  | { view: 'requirements'; entry: string };

/**
 * Where a link's target opens in this design: an element the outline has, in
 * the model; a need the design states, in the requirements; anything else
 * nowhere.
 */
export const descriptionTargets =
  (has: (path: string) => boolean, document: DesignDocumentInput) =>
  (target: string): DescriptionTarget | null => {
    if (target.startsWith(NEED)) {
      const need = target.slice(NEED.length);
      return findById(document.needs, need) === null
        ? null
        : { view: 'requirements', entry: needPath(need) };
    }
    return has(target) ? { view: 'model', node: target } : null;
  };

/**
 * The description as the page at `page` renders it: a link that opens
 * something becomes a link to that place on the page, any other is left as
 * its words. The link is absolute, since the editor that renders it reads
 * anything else as a web address missing its scheme.
 */
export const readableDescription = (
  markdown: string,
  resolve: (target: string) => DescriptionTarget | null,
  page: string,
): string =>
  markdown.replaceAll(DESCRIPTION_LINK, (_, label: string, target: string) => {
    const opens = resolve(target);
    return opens === null ? label : `[${label}](${hrefOf(page, opens)})`;
  });

/** Where a link written by `readableDescription` for `page` takes the reader, else null. */
export function targetOfHref(
  href: string,
  page: string,
): DescriptionTarget | null {
  const url = new URL(href, page);
  const here = new URL(page);
  if (url.origin !== here.origin || url.pathname !== here.pathname) return null;
  const node = url.searchParams.get('node');
  if (node !== null) return { view: 'model', node };
  const entry = url.searchParams.get('entry');
  if (url.searchParams.get('view') === 'requirements' && entry !== null)
    return { view: 'requirements', entry };
  return null;
}

function hrefOf(page: string, target: DescriptionTarget): string {
  const url = new URL(page);
  url.search = new URLSearchParams(
    target.view === 'model'
      ? { node: target.node }
      : { view: target.view, entry: target.entry },
  ).toString();
  url.hash = '';
  return url.href;
}
