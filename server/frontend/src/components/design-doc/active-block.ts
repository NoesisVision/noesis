import { useEditorSelectionChange } from '@blocknote/react';
import * as React from 'react';
import { resolveBlockElement } from '@/components/design-doc/editor-outline';
import type { DesignDocEditor } from '@/components/design-doc/editor-schema';

/**
 * The prototype's one-active-element affordance: the block the caret sits
 * in carries the focus ring (`.dd-active`), cleared when focus leaves the
 * editor. Imperative on purpose — a selection change should not re-render
 * the document.
 */
export function useActiveEditableRing(
  editor: DesignDocEditor,
  scrollRef: React.RefObject<HTMLDivElement | null>,
): void {
  const activeEditable = React.useRef<Element | null>(null);
  const setActiveEditable = React.useCallback((element: Element | null) => {
    if (element === activeEditable.current) return;
    activeEditable.current?.classList.remove('dd-active');
    element?.classList.add('dd-active');
    activeEditable.current = element;
  }, []);
  useEditorSelectionChange(() => {
    try {
      const block = editor.getTextCursorPosition().block as unknown as {
        id: string;
      };
      setActiveEditable(
        resolveBlockElement(block.id)?.querySelector('.dd-editable') ?? null,
      );
    } catch {
      setActiveEditable(null);
    }
  }, editor);
  React.useEffect(() => {
    const scroller = scrollRef.current;
    if (scroller === null) return;
    const onFocusOut = (event: FocusEvent) => {
      if (
        event.relatedTarget === null ||
        !scroller.contains(event.relatedTarget as Node)
      ) {
        setActiveEditable(null);
      }
    };
    scroller.addEventListener('focusout', onFocusOut);
    return () => scroller.removeEventListener('focusout', onFocusOut);
  }, [scrollRef, setActiveEditable]);
}
