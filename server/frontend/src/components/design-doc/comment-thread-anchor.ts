import { CommentsExtension } from '@blocknote/core/comments';
import * as React from 'react';
import type { DesignDocEditor } from '@/components/design-doc/editor-schema';

/**
 * The thread anchor pair from plan §3.8, `{ elementId, quote }`: the
 * floating composer calls `createThread` without metadata, so the
 * extension's method is wrapped to stamp the enclosing element's id and
 * the selected text on every new thread. With it, an orphaned mark
 * degrades a thread to its element with the quote as evidence.
 */
export function useThreadAnchorPatch(editor: DesignDocEditor): void {
  React.useEffect(() => {
    const comments = editor.getExtension(CommentsExtension);
    if (comments === undefined) return;
    const original = comments.createThread;
    const patchable = comments as { createThread: typeof original };
    patchable.createThread = (options) => {
      let anchor: Record<string, string> = {};
      try {
        const block = editor.getTextCursorPosition().block as unknown as {
          id: string;
        };
        anchor = { elementId: block.id, quote: editor.getSelectedText() };
      } catch {
        // No selection to anchor to; the mark alone will have to do.
      }
      return original({
        ...options,
        metadata: { ...(options.metadata ?? {}), ...anchor },
      });
    };
    return () => {
      patchable.createThread = original;
    };
  }, [editor]);
}
