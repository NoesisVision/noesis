import type { OutlineNode } from './model-outline.ts';
import type { OutlineTree } from './outline-tree.ts';

/*
 * Searching a tree is not filtering a list: a row that matches is no use
 * without the modules it sits in, so a result keeps the whole line down to
 * itself. What it does not keep is everything else, which is what makes a
 * deep model findable.
 *
 * Names and patterns are searched, descriptions are not. Properties, rules
 * and behaviours are rows of their own, so their names are reached without a
 * case of their own here.
 */

export interface OutlineSearch {
  /** Empty when nothing is being searched. */
  readonly tokens: readonly string[];
  readonly active: boolean;
  /** The rows the query itself found. */
  readonly matched: ReadonlySet<string>;
  /** The rows to draw: the matches, the line down to each, and what they hold. */
  readonly visible: ReadonlySet<string> | null;
  /** The rows that have to be open for the matches to be on screen. */
  readonly opened: ReadonlySet<string>;
}

const NOTHING: ReadonlySet<string> = new Set();

const QUIET: OutlineSearch = {
  tokens: [],
  active: false,
  matched: NOTHING,
  visible: null,
  opened: NOTHING,
};

/**
 * One spelling for both sides, so a reader who types `application service`
 * and a model that stores `application_service` are looking for each other.
 */
const plainly = (text: string) =>
  text.toLowerCase().replaceAll('_', ' ').replaceAll(/\s+/gu, ' ').trim();

export function searchTokens(query: string): string[] {
  const plain = plainly(query);
  return plain === '' ? [] : plain.split(' ');
}

const haystackOf = (node: OutlineNode) =>
  plainly(`${node.name} ${node.patternLabel ?? ''}`);

/** Every word, anywhere in the row: `service` finds an application service. */
const rowMatches = (tokens: readonly string[], node: OutlineNode): boolean => {
  const haystack = haystackOf(node);
  return tokens.every((token) => haystack.includes(token));
};

export function searchOutline(tree: OutlineTree, query: string): OutlineSearch {
  const tokens = searchTokens(query);
  if (tokens.length === 0) return QUIET;

  const matched = new Set<string>();
  for (const node of tree.nodes) {
    if (rowMatches(tokens, node)) matched.add(node.path);
  }

  const visible = new Set(matched);
  const opened = new Set<string>();
  for (const path of matched) {
    for (const ancestor of tree.ancestryOf(path)) {
      if (ancestor === path) break;
      visible.add(ancestor);
      opened.add(ancestor);
    }
  }

  /*
   * What a match holds stays reachable, so opening one shows its contents
   * rather than an empty row. The outline is in pre-order, so a parent has
   * always been decided by the time its children are read.
   */
  const beneath = new Set<string>();
  for (const node of tree.nodes) {
    const parent = node.parentPath;
    if (parent === null) continue;
    if (matched.has(parent) || beneath.has(parent)) {
      beneath.add(node.path);
      visible.add(node.path);
    }
  }

  return { tokens, active: true, matched, visible, opened };
}
