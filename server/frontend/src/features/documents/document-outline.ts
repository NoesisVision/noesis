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
const HEADING = /^(#{1,6})\s+(.+?)\s*#*\s*$/;
const LINK = /\[([^\]]+)\]\((https?:\/\/[^)\s]+)(?:\s+"[^"]*")?\)/g;
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
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/[*_`]/g, '')
    .trim();

/** The document's headings, in order, as far down as `deepest`. */
export function documentHeadings(
  markdown: string,
  deepest = 3,
): DocumentHeading[] {
  return proseLines(markdown).flatMap((line) => {
    const match = HEADING.exec(line);
    if (!match) return [];
    const depth = match[1]!.length;
    return depth <= deepest ? [{ text: plain(match[2]!), depth }] : [];
  });
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
      const clean = href.replace(/[.,;:]+$/, '');
      if (!seen.has(clean))
        seen.set(clean, { label: hostOf(clean), href: clean });
    }
  }
  return [...seen.values()];
}

/** A bare address by its host, which is what a reader recognises it by. */
function hostOf(href: string): string {
  try {
    return new URL(href).host;
  } catch {
    return href;
  }
}
