/*
 * The suggestion marks (plan phase 5): the ProseMirror mark vocabulary of
 * @handlewithcare/prosemirror-suggest-changes — `insertion`, `deletion` and
 * `modification` — declared as tiptap extensions the way BlockNote's own
 * xl-ai package declares them, so BlockNote allows them at block level
 * (`blockLevelSuggestion`) and keeps them out of the formatting toolbar
 * (`annotation`).
 *
 * Unlike the rest of this package this module is editor-coupled on purpose:
 * the frontend editor and the backend's headless schema MUST register
 * identical marks, because y-prosemirror deletes any Y node whose marks the
 * reading schema cannot construct (the phase-4 comment-mark lesson). One
 * shared definition is what keeps the two schemas from drifting. The main
 * entry (`index.ts`) stays structural and does not export this module.
 *
 * Suggestion ids are strings of the form `<accountId>:<nonce>` (the library
 * allows string ids), so authorship travels in the mark itself and needs no
 * side table that could race under concurrent editing.
 */

import { Mark } from '@tiptap/core';

/** Groups BlockNote reads when compiling the ProseMirror schema. */
const SUGGESTION_MARK_GROUPS = 'blockLevelSuggestion annotation';

const insertion = Mark.create({
  name: 'insertion',
  inclusive: false,
  excludes: 'deletion modification insertion',
  group: SUGGESTION_MARK_GROUPS,
  addAttributes() {
    return { id: { default: null, validate: 'number|string' } };
  },
  extendMarkSchema(extension) {
    if (extension.name !== 'insertion') return {};
    return {
      blocknoteIgnore: true,
      inclusive: false,
      toDOM(mark: { attrs: { id: unknown } }, inline: boolean) {
        return [
          'ins',
          {
            'data-id': String(mark.attrs.id),
            'data-inline': String(inline),
            ...(inline ? {} : { style: 'display: contents' }),
          },
          0,
        ];
      },
      // `[data-id]` plus a high priority keep the round-trip exact: BlockNote's
      // strike style also claims bare `del`/`s` tags, and if it wins the
      // re-parse, ProseMirror's DOM reader sees a document that differs from
      // the view and dispatches a self-replacing step — while suggesting,
      // that step becomes a fresh insertion, growing the document forever.
      parseDOM: [
        {
          tag: 'ins[data-id]',
          priority: 100,
          getAttrs(node: { dataset: Record<string, string | undefined> }) {
            return node.dataset.id ? { id: node.dataset.id } : false;
          },
        },
      ],
    };
  },
});

const deletion = Mark.create({
  name: 'deletion',
  inclusive: false,
  excludes: 'insertion modification deletion',
  group: SUGGESTION_MARK_GROUPS,
  addAttributes() {
    return { id: { default: null, validate: 'number|string' } };
  },
  extendMarkSchema(extension) {
    if (extension.name !== 'deletion') return {};
    return {
      blocknoteIgnore: true,
      inclusive: false,
      toDOM(mark: { attrs: { id: unknown } }, inline: boolean) {
        return [
          'del',
          {
            'data-id': String(mark.attrs.id),
            'data-inline': String(inline),
            ...(inline ? {} : { style: 'display: contents' }),
          },
          0,
        ];
      },
      // See the insertion mark: the attribute selector and priority keep
      // this rule ahead of the strike style's bare `del` rule.
      parseDOM: [
        {
          tag: 'del[data-id]',
          priority: 100,
          getAttrs(node: { dataset: Record<string, string | undefined> }) {
            return node.dataset.id ? { id: node.dataset.id } : false;
          },
        },
      ],
    };
  },
});

const modification = Mark.create({
  name: 'modification',
  inclusive: false,
  excludes: 'deletion insertion',
  group: SUGGESTION_MARK_GROUPS,
  addAttributes() {
    return {
      id: { default: null, validate: 'number|string' },
      type: { default: null },
      attrName: { default: null },
      previousValue: { default: null },
      newValue: { default: null },
    };
  },
  extendMarkSchema(extension) {
    if (extension.name !== 'modification') return {};
    return {
      blocknoteIgnore: true,
      inclusive: false,
      toDOM(
        mark: {
          attrs: {
            id: unknown;
            type: unknown;
            previousValue: unknown;
            newValue: unknown;
          };
        },
        inline: boolean,
      ) {
        return [
          inline ? 'span' : 'div',
          {
            'data-type': 'modification',
            'data-id': String(mark.attrs.id),
            'data-mod-type': String(mark.attrs.type),
            'data-mod-prev-val': JSON.stringify(mark.attrs.previousValue),
            'data-mod-new-val': JSON.stringify(mark.attrs.newValue),
          },
          0,
        ];
      },
      parseDOM: [
        {
          tag: "span[data-type='modification']",
          priority: 100,
          getAttrs(node: { dataset: Record<string, string | undefined> }) {
            if (!node.dataset.id) return false;
            return {
              id: node.dataset.id,
              type: node.dataset.modType,
              previousValue: node.dataset.modPrevVal,
              newValue: node.dataset.modNewVal,
            };
          },
        },
        {
          tag: "div[data-type='modification']",
          priority: 100,
          getAttrs(node: { dataset: Record<string, string | undefined> }) {
            if (!node.dataset.id) return false;
            return {
              id: node.dataset.id,
              type: node.dataset.modType,
              previousValue: node.dataset.modPrevVal,
            };
          },
        },
      ],
    };
  },
});

/** The three marks, in the order they should be registered. */
export const SUGGESTION_MARK_EXTENSIONS = [insertion, deletion, modification];

/** A fresh suggestion id carrying its author. */
export function newSuggestionId(accountId: string): string {
  return `${accountId}:${Math.random().toString(36).slice(2, 10)}`;
}

/** The account id a suggestion id carries, null for foreign/numeric ids. */
export function suggestionAuthorId(id: string | number): string | null {
  if (typeof id !== 'string') return null;
  const separator = id.indexOf(':');
  return separator === -1 ? null : id.slice(0, separator);
}
