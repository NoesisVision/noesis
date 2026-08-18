import { describe, expect, it } from 'bun:test';
import {
  applySuggestions,
  suggestChanges,
  transformToSuggestionTransaction,
} from '@handlewithcare/prosemirror-suggest-changes';
import { designDocFixture } from '@repo/shared-contracts/design-doc.fixture';
import type { Node } from 'prosemirror-model';
import { EditorState, TextSelection } from 'prosemirror-state';
import {
  prosemirrorToYXmlFragment,
  yXmlFragmentToProseMirrorRootNode,
} from 'y-prosemirror';
import * as Y from 'yjs';
import {
  COLLAB_FRAGMENT,
  designDocPmSchema,
  projectYDoc,
  seedYDocState,
} from '../../src/design-docs/design-doc-editor.server.js';

/*
 * Phase 5: the projection is the ACCEPTED document. A pending suggestion —
 * marks produced by prosemirror-suggest-changes and carried in the shared
 * fragment — must not leak into the DesignDocument cache; an accepted one
 * must land in it. The suggesting transform here is the same one the
 * frontend's dispatch wrap runs.
 */

const SIDECAR_MAP = 'design-doc-sidecar';

function seededYDoc(): Y.Doc {
  const ydoc = new Y.Doc();
  Y.applyUpdate(ydoc, seedYDocState(designDocFixture));
  return ydoc;
}

/** The seeded document as an editable ProseMirror state. */
function suggestingState(ydoc: Y.Doc): EditorState {
  const doc = yXmlFragmentToProseMirrorRootNode(
    ydoc.getXmlFragment(COLLAB_FRAGMENT),
    designDocPmSchema(),
  );
  return EditorState.create({ doc, plugins: [suggestChanges()] });
}

/** Write a ProseMirror doc back into a Y.Doc alongside the original sidecar. */
function toYDoc(doc: Node, sidecarJson: string): Y.Doc {
  const ydoc = new Y.Doc();
  prosemirrorToYXmlFragment(doc, ydoc.getXmlFragment(COLLAB_FRAGMENT));
  ydoc.getMap(SIDECAR_MAP).set('json', sidecarJson);
  return ydoc;
}

/** Run an editing transaction through the suggesting transform. */
function suggest(
  state: EditorState,
  edit: (tr: import('prosemirror-state').Transaction) => void,
): EditorState {
  const tr = state.tr;
  edit(tr);
  const tracked = transformToSuggestionTransaction(tr, state, () => 'acc-1:x');
  return state.apply(tracked);
}

/** The position of a text snippet in the doc, as a from/to range. */
function findText(doc: Node, snippet: string): { from: number; to: number } {
  let found: { from: number; to: number } | null = null;
  doc.descendants((node, pos) => {
    if (found !== null || !node.isText) return found === null;
    const index = (node.text ?? '').indexOf(snippet);
    if (index !== -1) {
      found = { from: pos + index, to: pos + index + snippet.length };
    }
    return false;
  });
  if (found === null) throw new Error(`"${snippet}" not found in doc`);
  return found;
}

describe('design-doc projection under suggestions', () => {
  it('keeps a pending suggested insertion out of the projection', () => {
    const ydoc = seededYDoc();
    const sidecar = ydoc.getMap(SIDECAR_MAP).get('json') as string;
    const state = suggestingState(ydoc);

    const goalEnd = findText(state.doc, designDocFixture.goal).to;
    const suggested = suggest(state, (tr) => {
      tr.setSelection(TextSelection.create(tr.doc, goalEnd));
      tr.insertText(' SUGGESTED', goalEnd);
    });

    // The marked run is in the doc…
    expect(suggested.doc.textContent).toContain('SUGGESTED');
    // …but the projection reads the accepted document.
    const projected = projectYDoc(toYDoc(suggested.doc, sidecar));
    expect(projected.goal).toBe(designDocFixture.goal);
  });

  it('keeps suggested-deleted text in the projection until accepted', () => {
    const ydoc = seededYDoc();
    const sidecar = ydoc.getMap(SIDECAR_MAP).get('json') as string;
    const state = suggestingState(ydoc);

    const range = findText(state.doc, designDocFixture.goal);
    const suggested = suggest(state, (tr) => {
      tr.delete(range.from, range.to);
    });

    const projected = projectYDoc(toYDoc(suggested.doc, sidecar));
    expect(projected.goal).toBe(designDocFixture.goal);
  });

  it('projects the change once suggestions are accepted', () => {
    const ydoc = seededYDoc();
    const sidecar = ydoc.getMap(SIDECAR_MAP).get('json') as string;
    const state = suggestingState(ydoc);

    const goalEnd = findText(state.doc, designDocFixture.goal).to;
    const suggested = suggest(state, (tr) => {
      tr.insertText(' SUGGESTED', goalEnd);
    });

    let accepted = suggested;
    applySuggestions(suggested, (tr) => {
      accepted = suggested.apply(tr);
    });

    const projected = projectYDoc(toYDoc(accepted.doc, sidecar));
    expect(projected.goal).toBe(`${designDocFixture.goal} SUGGESTED`);
  });
});
