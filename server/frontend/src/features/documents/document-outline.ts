/*
 * What a document is made of and where it points, read from its markdown for
 * the cards beside it: its sections by their headings, and the pages it links
 * to. A fenced block is code, never a heading or a link.
 */

/** A heading of the document: its words, and how deep it sits (1 to 6). */
export interface DocumentHeading {
  text: string;
  depth: number;
}

/** A page the document links to: the words it is linked by, and where. */
export interface DocumentLink {
  label: string;
  href: string;
}

const FENCE = /^\s*(```|~~~)/;
const HEADING = /^(#{1,6})[ \t]+(\S.*)$/;
const LINK = /\[([^[\]]+)\]\((https?:\/\/[^)\s]+)(?:\s+"[^"]*")?\)/g;
const BARE = /(?<![(<"\w])(https?:\/\/[^\s)>\]]+)/g;

/** The lines of the markdown that are prose, not code. */
function proseLines(markdown: string): string[] {
  let fenced = false;
  return markdown.split('\n').filter((line) => {
    if (FENCE.test(line)) {
      fenced = !fenced;
      return false;
    }
    return !fenced;
  });
}

/** Markdown's inline marks taken off, as a heading reads on the page. */
const plain = (text: string) =>
  text
    .replace(/\[([^[\]]+)\]\([^)]*\)/g, '$1')
    .replace(/[*_`]/g, '')
    .trim();

/** The document's headings, in order, as far down as `deepest`. */
export function documentHeadings(
  markdown: string,
  deepest = 3,
): DocumentHeading[] {
  return proseLines(markdown).flatMap((line) => {
    const match = HEADING.exec(line.trimEnd());
    if (!match) return [];
    const depth = match[1]!.length;
    // A heading may close with a run of #s, which is not part of its words.
    const text = plain(trimTrailing(match[2]!, '#'));
    return depth <= deepest && text ? [{ text, depth }] : [];
  });
}

/**
 * The fragment a link in the document names a heading by, as GitHub writes
 * it: the heading's words in lower case, their marks and punctuation left
 * out, a hyphen for each space.
 */
export function headingSlug(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s_-]/gu, '')
    .replace(/\s/g, '-');
}

/**
 * Which of the headings a fragment (`#glossary`) names: the first with that
 * slug, or, for `-1`, `-2`… on the end, the second, the third… with it, as
 * GitHub tells headings with the same words apart. None for no heading.
 */
export function headingOfFragment(
  headings: DocumentHeading[],
  fragment: string,
): number | null {
  const wanted = fragment.replace(/^#/, '').toLowerCase();
  const seen = new Map<string, number>();
  for (const [index, heading] of headings.entries()) {
    const slug = headingSlug(heading.text);
    const count = seen.get(slug) ?? 0;
    seen.set(slug, count + 1);
    if ((count === 0 ? slug : `${slug}-${count}`) === wanted) return index;
  }
  return null;
}

/** Every web page the document links to, once each, in the order first linked. */
export function documentLinks(markdown: string): DocumentLink[] {
  const seen = new Map<string, DocumentLink>();
  for (const line of proseLines(markdown)) {
    // A code span that is an address alone reads as one, and the page draws
    // it as a link; any other code span is code.
    const prose = line.replace(/`([^`]*)`/g, (_, code: string) =>
      /^https?:\/\/\S+$/.test(code.trim()) ? ` ${code.trim()} ` : '',
    );
    for (const [, label, href] of prose.matchAll(LINK)) {
      if (href && !seen.has(href))
        seen.set(href, { label: plain(label!), href });
    }
    for (const [href] of prose.replace(LINK, '').matchAll(BARE)) {
      const clean = trimTrailing(href, '.,;:');
      if (!seen.has(clean))
        seen.set(clean, { label: hostOf(clean), href: clean });
    }
  }
  return [...seen.values()];
}

/**
 * The text with any run of `chars` at its end taken off — by hand, since a
 * regular expression anchored at the end backtracks on long runs.
 */
function trimTrailing(text: string, chars: string): string {
  let end = text.length;
  while (end > 0 && chars.includes(text[end - 1]!)) end--;
  return text.slice(0, end).trimEnd();
}

/** A bare address by its host, which is what a reader recognises it by. */
function hostOf(href: string): string {
  try {
    return new URL(href).host;
  } catch {
    return href;
  }
}
