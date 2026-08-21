import { insertOrUpdateBlockForSlashMenu } from '@blocknote/core';
import type { DefaultReactSuggestionItem } from '@blocknote/react';
import {
  blockGroup,
  DESIGN_DOC_BLOCK_SPECS,
  type DesignDocBlockType,
} from '@repo/design-doc-blocks';
import * as React from 'react';
import type { DesignDocEditor } from '@/components/design-doc/editor-schema';

/*
 * The schema-aware editing rules (plan §4): the slash menu offers only the
 * typed elements the schema allows at the caret, the drag-handle menu offers
 * deletion only where the schema allows the element to be absent, and block
 * drag-and-drop is constrained to same-group siblings (the prototype's
 * data-group rule). The drag-handle menu component itself lives in
 * typed-editing-menu.tsx, kept out of this file so it exports only
 * components (Fast Refresh).
 */

export type BlockLike = {
  id: string;
  type: string;
  props: Record<string, unknown>;
};

/** The reorder group of a live block, null for fixed-place or untyped ones. */
export function groupOfBlock(block: BlockLike | undefined): string | null {
  if (block === undefined || !(block.type in DESIGN_DOC_BLOCK_SPECS)) {
    return null;
  }
  return blockGroup(
    block.type as DesignDocBlockType,
    block.props as Record<string, string | number | boolean>,
  );
}

/**
 * Paste coercion (plan §7, phase-3 gap): clipboard text lands as plain text
 * in the typed block at the caret, never as `paragraph` blocks the
 * projection would ignore. Extra lines become sibling blocks of the same
 * type where the schema keeps a list (the block has a reorder group), with
 * the owner props cloned; elsewhere they fold into one line. BlockNote's own
 * clipboard format still round-trips through the default handler — it
 * re-inserts typed blocks of this same schema.
 */
export function typedPasteHandler({
  event,
  editor,
  defaultPasteHandler,
}: {
  event: ClipboardEvent;
  editor: DesignDocEditor;
  defaultPasteHandler: () => boolean | undefined;
}): boolean | undefined {
  if (event.clipboardData?.types.includes('blocknote/html') === true) {
    return defaultPasteHandler();
  }
  const text = event.clipboardData?.getData('text/plain') ?? '';
  if (text === '') return false;
  let current: BlockLike;
  try {
    current = editor.getTextCursorPosition().block as unknown as BlockLike;
  } catch {
    return false;
  }
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line !== '');
  const [first, ...rest] = lines;
  if (first === undefined) return true;
  if (rest.length === 0 || groupOfBlock(current) === null) {
    editor.insertInlineContent([lines.join(' ')]);
    return true;
  }
  editor.insertInlineContent([first]);
  // Only the owner/discriminator props carry over — content-ish props
  // (a field's name, a note) must not be stamped onto every pasted line.
  const carried: Record<string, unknown> = {};
  for (const key of ['useCaseId', 'direction', 'scope']) {
    if (key in current.props) carried[key] = current.props[key];
  }
  editor.insertBlocks(
    rest.map((line) => ({
      type: current.type,
      props: { ...carried },
      content: line,
    })) as never,
    current.id,
    'after',
  );
  return true;
}

/** The use case the caret sits in, from the flat block order. */
function enclosingUseCaseId(
  editor: DesignDocEditor,
  currentBlockId: string,
): string | null {
  let useCaseId: string | null = null;
  for (const block of editor.document as unknown as BlockLike[]) {
    if (block.type === 'useCaseHeading') useCaseId = block.id;
    if (block.type === 'contextHeading' || block.type === 'serviceHeading') {
      useCaseId = null;
    }
    if (block.id === currentBlockId) return useCaseId;
    if (
      typeof block.props.useCaseId === 'string' &&
      block.props.useCaseId !== ''
    ) {
      useCaseId = block.props.useCaseId;
    }
  }
  return useCaseId;
}

/**
 * The one block menu (plan §4): the typed elements insertable at the caret,
 * never the default set. Document-level elements outside the use cases; a use
 * case's own elements inside one, with their owner stamped on the new block.
 */
export function typedSlashItems(
  editor: DesignDocEditor,
): DefaultReactSuggestionItem[] {
  const current = editor.getTextCursorPosition().block as unknown as BlockLike;
  const useCaseId = enclosingUseCaseId(editor, current.id);

  const item = (
    title: string,
    type: string,
    props: Record<string, string>,
  ): DefaultReactSuggestionItem => ({
    title,
    group: useCaseId === null ? 'Document' : 'Use case',
    onItemClick: () => {
      insertOrUpdateBlockForSlashMenu(
        editor as never,
        { type, props } as never,
      );
    },
  });

  if (useCaseId === null) {
    // The goal is a single slot — offered only while its block is absent, so
    // the "not written yet" line has an insert path.
    const hasGoal = (editor.document as unknown as BlockLike[]).some(
      (block) => block.type === 'goal',
    );
    return [
      ...(hasGoal ? [] : [item('Goal', 'goal', {})]),
      item('Context paragraph', 'contextParagraph', {}),
      item('Target outcome', 'outcome', {}),
      item('Scope item (in scope)', 'scopeItem', { scope: 'in' }),
      item('Scope item (out of scope)', 'scopeItem', { scope: 'out' }),
      item('Actor', 'actor', {}),
    ];
  }
  return [
    item('Rule', 'rule', { useCaseId }),
    item('Input field', 'fieldRow', { useCaseId, direction: 'input' }),
    item('Output field', 'fieldRow', { useCaseId, direction: 'output' }),
    item('Acceptance scenario', 'scenario', {
      useCaseId,
      data: JSON.stringify({ title: '', steps: [] }),
    }),
    item('Quality attribute', 'qualityAttribute', { useCaseId }),
    item('Summary', 'useCaseSummary', { useCaseId }),
    item('Description', 'useCaseDescription', { useCaseId }),
  ];
}

/** Whether the schema allows this block type to be deleted. */
export const removable = (type: string): boolean =>
  DESIGN_DOC_BLOCK_SPECS[type as keyof typeof DESIGN_DOC_BLOCK_SPECS]
    ?.removable ?? true;

/**
 * Drag and drop constrained to same-group siblings (plan §4, the
 * prototype's data-group rule): a block drag may only drop onto a block of
 * the same reorder group. Capture phase at the document level runs ahead
 * of BlockNote's own document-level drop handling; anything else is
 * cancelled — including foreign drops into the pane, which would insert
 * untyped blocks the projection ignores.
 */
export function useConstrainedDrop(
  editor: DesignDocEditor,
  scrollRef: React.RefObject<HTMLDivElement | null>,
): void {
  React.useEffect(() => {
    const onDropCapture = (event: DragEvent) => {
      const cancel = () => {
        event.preventDefault();
        event.stopImmediatePropagation();
      };
      const over = document.elementFromPoint(event.clientX, event.clientY);
      const html = event.dataTransfer?.getData('blocknote/html') ?? '';
      if (html === '') {
        // Not a block drag: refuse foreign content dropped into the pane.
        if (over !== null && scrollRef.current?.contains(over) === true) {
          cancel();
        }
        return;
      }
      const draggedId = /data-id="([^"]+)"/.exec(html)?.[1];
      const targetId = over?.closest('[data-id]')?.getAttribute('data-id');
      const dragged =
        draggedId === undefined
          ? undefined
          : (editor.getBlock(draggedId) as unknown as BlockLike | undefined);
      const target =
        targetId == null
          ? undefined
          : (editor.getBlock(targetId) as unknown as BlockLike | undefined);
      const draggedGroup = groupOfBlock(dragged);
      if (draggedGroup === null || draggedGroup !== groupOfBlock(target)) {
        cancel();
      }
    };
    document.addEventListener('drop', onDropCapture, true);
    return () => document.removeEventListener('drop', onDropCapture, true);
  }, [editor, scrollRef]);
}
