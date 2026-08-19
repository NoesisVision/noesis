import { BlockNoteSchema, defaultBlockSpecs } from '@blocknote/core';
import { createReactBlockSpec } from '@blocknote/react';
import {
  DESIGN_DOC_BLOCK_SPECS,
  type DesignDocBlockType,
} from '@repo/design-doc-blocks';
import { RENDERERS } from '@/components/design-doc/editor-blocks';

// The typed BlockNote schema, assembled from the shared block configs and the
// React renders in editor-blocks.tsx. Kept out of that file so the component
// module exports only components (Fast Refresh).

function buildBlockSpecs() {
  return Object.fromEntries(
    Object.entries(DESIGN_DOC_BLOCK_SPECS).map(([type, spec]) => [
      type,
      createReactBlockSpec(
        {
          type,
          propSchema: spec.props,
          content: spec.content,
        },
        {
          render: RENDERERS[type as DesignDocBlockType] as never,
        },
      )(),
    ]),
  );
}

/**
 * The paragraph spec stays because the editor machinery needs a default
 * block type; the projection ignores stray paragraphs. Everything else in
 * the document is a typed element.
 */
export const designDocSchema = BlockNoteSchema.create({
  blockSpecs: { paragraph: defaultBlockSpecs.paragraph, ...buildBlockSpecs() },
});

export type DesignDocEditor = typeof designDocSchema.BlockNoteEditor;
