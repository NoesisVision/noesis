import {
  BlockNoteSchema,
  createBlockSpec,
  createExtension,
  defaultBlockSpecs,
  docToBlocks,
} from '@blocknote/core';
import {
  CommentsExtension,
  DefaultThreadStoreAuth,
} from '@blocknote/core/comments';
import { YjsThreadStore } from '@blocknote/core/yjs';
import { ServerBlockNoteEditor } from '@blocknote/server-util';
import { revertSuggestions } from '@handlewithcare/prosemirror-suggest-changes';
import {
  DESIGN_DOC_BLOCK_SPECS,
  type DesignDocBlock,
  type DesignDocBlockDocument,
  type DesignDocSidecar,
  toBlocks,
  toDocument,
} from '@repo/design-doc-blocks';
import { SUGGESTION_MARK_EXTENSIONS } from '@repo/design-doc-blocks/suggestion-marks';
import type { DesignDocument } from '@repo/shared-contracts';
import type { Schema } from 'prosemirror-model';
import { EditorState } from 'prosemirror-state';
import { yXmlFragmentToProseMirrorRootNode } from 'y-prosemirror';
import * as Y from 'yjs';

/*
 * Headless design-doc editing: DesignDocument ↔ blocks ↔ Y.Doc, without a
 * browser (decision 51 — seeding runs server-side, exactly once, and the
 * projection is derived on read). The BlockNote schema here shares its block
 * configs with the frontend editor through @repo/design-doc-blocks; only the
 * render differs, and render is never called headless.
 */

/** The Y.XmlFragment BlockNote's collaboration mode edits. */
export const COLLAB_FRAGMENT = 'document-store';
/** Where the sidecar (identity + unrendered vocabulary) lives in the Y.Doc. */
const SIDECAR_MAP = 'design-doc-sidecar';

const serverRender = () => {
  throw new Error('The server-side design-doc schema does not render.');
};

function buildServerSchema() {
  const blockSpecs = Object.fromEntries(
    Object.entries(DESIGN_DOC_BLOCK_SPECS).map(([type, spec]) => [
      type,
      createBlockSpec(
        {
          type,
          propSchema: spec.props,
          content: spec.content,
        },
        { render: serverRender },
      )(),
    ]),
  );
  // The paragraph spec stays in the schema because the editor machinery
  // needs a default block type to boot with; the projection ignores stray
  // paragraphs and the frontend coerces them away ("nothing untyped").
  return BlockNoteSchema.create({
    blockSpecs: { paragraph: defaultBlockSpecs.paragraph, ...blockSpecs },
  });
}

/** One shared headless editor — schema construction is not free. */
const serverEditor = ServerBlockNoteEditor.create({
  schema: buildServerSchema(),
  // The comments extension is here for its mark alone: the frontend stores
  // comment anchors as a `comment` ProseMirror mark in the shared fragment
  // (phase 4), and y-prosemirror DELETES any Y node whose marks the reading
  // schema does not know — running the projection over a live Y.Doc without
  // this mark would destroy every commented text run. The store never
  // receives a write headless; it exists to satisfy the constructor.
  extensions: [
    CommentsExtension({
      threadStore: new YjsThreadStore(
        'server',
        new Y.Doc().getMap('threads'),
        new DefaultThreadStoreAuth('server', 'editor'),
      ),
      resolveUsers: async () => [],
    }),
    // The suggestion marks (phase 5), for the same reason as the comment
    // mark above: without them the projection destroys every suggested run.
    // The cast bridges two structurally identical @tiptap/core Mark
    // instantiations tsc treats as unrelated across package boundaries.
    createExtension({
      key: 'suggestionMarks',
      tiptapExtensions: SUGGESTION_MARK_EXTENSIONS as unknown as never[],
    }),
  ],
});

/**
 * Seed a fresh Y.Doc from a validated document (decision 51.6). Returns the
 * encoded state to persist; clients only ever sync into this, never
 * initialise an empty document.
 */
export function seedYDocState(document: DesignDocument): Uint8Array {
  const { blocks, sidecar } = toBlocks(document);
  const ydoc = serverEditor.blocksToYDoc(blocks as never, COLLAB_FRAGMENT);
  ydoc.getMap(SIDECAR_MAP).set('json', JSON.stringify(sidecar));
  return Y.encodeStateAsUpdate(ydoc);
}

/**
 * The accepted document as blocks: pending suggestions are reverted on a
 * throwaway ProseMirror state first — suggested insertions are dropped and
 * suggested deletions kept — so what nobody has accepted yet never reaches
 * the `DesignDocument` projection (plan phase 5: what a person asks for is
 * applied; what is only suggested stays pending).
 */
function acceptedBlocks(ydoc: Y.Doc): DesignDocBlock[] {
  const doc = yXmlFragmentToProseMirrorRootNode(
    ydoc.getXmlFragment(COLLAB_FRAGMENT),
    serverEditor.editor.pmSchema,
  );
  let accepted = doc;
  revertSuggestions(EditorState.create({ doc }), (tr) => {
    accepted = tr.doc;
  });
  return docToBlocks(accepted) as unknown as DesignDocBlock[];
}

export function readBlockDocument(ydoc: Y.Doc): DesignDocBlockDocument {
  const raw = ydoc.getMap(SIDECAR_MAP).get('json');
  if (typeof raw !== 'string') {
    throw new Error('Y.Doc carries no design-doc sidecar; was it seeded?');
  }
  const sidecar = JSON.parse(raw) as DesignDocSidecar;
  return { blocks: acceptedBlocks(ydoc), sidecar };
}

/** The projection: Y.Doc → DesignDocument (decision 51.3). */
export function projectYDoc(ydoc: Y.Doc): DesignDocument {
  const { blocks, sidecar } = readBlockDocument(ydoc);
  return toDocument(blocks, sidecar);
}

/** The headless ProseMirror schema — exposed for tests that build states. */
export function designDocPmSchema(): Schema {
  return serverEditor.editor.pmSchema;
}

export function projectState(state: Uint8Array): DesignDocument {
  const ydoc = new Y.Doc();
  Y.applyUpdate(ydoc, state);
  return projectYDoc(ydoc);
}
