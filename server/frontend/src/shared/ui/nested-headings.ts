import {
  $createHeadingNode,
  $isHeadingNode,
  type HeadingNode,
} from '@lexical/rich-text';
import {
  addExportVisitor$,
  addImportVisitor$,
  type LexicalExportVisitor,
  type MdastImportVisitor,
  realmPlugin,
} from '@mdxeditor/editor';
import type { Heading } from 'mdast';

const HEADING_DEPTHS = [1, 2, 3, 4, 5, 6] as const;
export type HeadingDepth = (typeof HEADING_DEPTHS)[number];

const DEEPEST = 6;

/** Ahead of the headings plugin's own pair, which map a level to itself. */
const ABOVE_DEFAULT = 1;

/**
 * The page around a document is already headed, so the document's own `#` has
 * to nest under that heading rather than open a second `h1` beside it — the
 * shift the reader did before the editor replaced it.
 *
 * It is undone on the way out, so the markdown keeps the levels its author
 * wrote. Only the bottom of the scale is lossy: a level that would land past
 * `h6` is clamped there and comes back one step short, exactly as deep a
 * document as the reader could not show either.
 */
export const nestedHeadingsPlugin = realmPlugin<{ topLevel: HeadingDepth }>({
  init(realm, params) {
    const step = (params?.topLevel ?? 2) - 1;
    realm.pubIn({
      [addImportVisitor$]: nestOnImport(step),
      [addExportVisitor$]: unnestOnExport(step),
    });
  },
});

export function nestOnImport(step: number): MdastImportVisitor<Heading> {
  return {
    testNode: 'heading',
    priority: ABOVE_DEFAULT,
    visitNode({ mdastNode, actions }) {
      actions.addAndStepInto(
        $createHeadingNode(`h${within(mdastNode.depth + step)}`),
      );
    },
  };
}

export function unnestOnExport(
  step: number,
): LexicalExportVisitor<HeadingNode, Heading> {
  return {
    testLexicalNode: $isHeadingNode,
    priority: ABOVE_DEFAULT,
    visitLexicalNode({ lexicalNode, actions }) {
      const shown = Number(lexicalNode.getTag().slice(1));
      actions.addAndStepInto('heading', { depth: within(shown - step) });
    },
  };
}

function within(depth: number): HeadingDepth {
  return Math.min(Math.max(depth, 1), DEEPEST) as HeadingDepth;
}
