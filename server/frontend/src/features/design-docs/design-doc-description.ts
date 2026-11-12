import { NEED } from '#/shared/model/element-id.ts';
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
 *
 * An id with a space in it — a rule's, whose name is a sentence, or a
 * block's like `Order Repository` — is written in the link's angle brackets,
 * as CommonMark allows, `[Paid](<noesis:rule|sales.Paid orders only>)`, or
 * with the space percent-encoded.
 */

const DESCRIPTION_LINK =
  /\[([^\]]*)\]\((?:<noesis:([^>\n]+)>|noesis:([^)\s]+))\)/g;

/** A link of the description: the words it is written with and the id it names. */
interface DescriptionLink {
  label: string;
  target: string;
}

function* linksIn(markdown: string): Generator<DescriptionLink> {
  for (const [, label = '', bracketed, bare] of markdown.matchAll(
    DESCRIPTION_LINK,
  ))
    yield { label, target: decoded(bracketed ?? bare ?? '') };
}

/** The id a link target spells, its percent-escapes read; one that is no escape is taken as written. */
function decoded(target: string): string {
  try {
    return decodeURIComponent(target);
  } catch (error) {
    if (error instanceof URIError) return target;
    throw error;
  }
}

/** Where a link in the description takes the reader: a row of the model, or an entry of the requirements. */
export type DescriptionTarget =
  | { view: 'model'; node: string }
  | { view: 'requirements'; entry: string };

/**
 * Where a link's target opens in this design: an element the outline has, at
 * its row in the model — a rule or a scenario at the first row it is shown
 * at; a need the design states, in the requirements; anything else nowhere.
 */
export const descriptionTargets =
  (rowOf: (id: string) => string | null, document: DesignDocumentInput) =>
  (target: string): DescriptionTarget | null => {
    if (target.startsWith(NEED)) {
      const need = target.slice(NEED.length);
      return findById(document.needs, need) === null
        ? null
        : { view: 'requirements', entry: needPath(need) };
    }
    const row = rowOf(target);
    return row === null ? null : { view: 'model', node: row };
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
  markdown.replaceAll(
    DESCRIPTION_LINK,
    (_, label: string, bracketed?: string, bare?: string) => {
      const opens = resolve(decoded(bracketed ?? bare ?? ''));
      return opens === null
        ? label
        : `[${label}](${hrefOf(page, opens)} "${OPENS_IN[opens.view]}")`;
    },
  );

/** What a link says it does, for whoever cannot see the icon before it. */
const OPENS_IN: Record<DescriptionTarget['view'], string> = {
  model: 'Opens in Model',
  requirements: 'Opens in Requirements',
};

/** The views the description's links open, in the order the tabs show them. */
export function linkedViews(
  markdown: string,
  resolve: (target: string) => DescriptionTarget | null,
): DescriptionTarget['view'][] {
  const views = new Set(
    [...linksIn(markdown)].map(({ target }) => resolve(target)?.view),
  );
  return (['model', 'requirements'] as const).filter((view) => views.has(view));
}

/** A place the description links to, under the words the first link to it used. */
export interface LinkedTarget {
  label: string;
  target: DescriptionTarget;
}

/**
 * Every place the description's links open, once each, in the order they are
 * first linked: what the overview names, listed beside it. A link that opens
 * nothing is left out, as it is from the prose.
 */
export function linkedTargets(
  markdown: string,
  resolve: (target: string) => DescriptionTarget | null,
): LinkedTarget[] {
  const seen = new Map<string, LinkedTarget>();
  for (const { label, target } of linksIn(markdown)) {
    const opens = resolve(target);
    if (opens !== null && !seen.has(target)) {
      seen.set(target, { label, target: opens });
    }
  }
  return [...seen.values()];
}

/** Where a link written by `readableDescription` for `page` takes the reader, else null. */
export function targetOfHref(
  href: string,
  page: string,
): DescriptionTarget | null {
  const url = new URL(href, page);
  const here = new URL(page);
  if (url.origin !== here.origin || url.pathname !== here.pathname) return null;
  const view = url.searchParams.get('view');
  const node = url.searchParams.get('node');
  if (view === 'model' && node !== null) return { view, node };
  const entry = url.searchParams.get('entry');
  if (view === 'requirements' && entry !== null) return { view, entry };
  return null;
}

function hrefOf(page: string, target: DescriptionTarget): string {
  const url = new URL(page);
  url.search = new URLSearchParams(
    target.view === 'model'
      ? { view: target.view, node: target.node }
      : { view: target.view, entry: target.entry },
  ).toString();
  url.hash = '';
  return url.href;
}
