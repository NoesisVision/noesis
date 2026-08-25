import { SideMenuExtension } from '@blocknote/core';
import {
  useBlockNoteEditor,
  useComponentsContext,
  useExtensionState,
} from '@blocknote/react';
import { Trash2 } from 'lucide-react';
import {
  type BlockLike,
  removable,
} from '@/components/design-doc/typed-editing';

/**
 * Disables the drag handle's own built-in dropdown (colors/table headers/
 * delete — none of it schema-aware): deletion is handled by
 * `TypedDeleteButton` instead, gated on the schema's `removable` check. Also
 * sidesteps that dropdown's Menu.Trigger, which opens on mousedown (Base UI,
 * to support press-and-hold-to-select) and collides with dragging the same
 * handle — see `useConstrainedDrop`'s dragend fix in typed-editing.ts.
 */
export function NoDragHandleMenu(): null {
  return null;
}

/**
 * Schema-aware deletion (plan §4): list members can be deleted, elements the
 * schema requires cannot. Rendered as a plain icon button next to Add/Drag in
 * the side menu, not behind a dropdown. The hovered block comes from the
 * side-menu extension's state, the same source the default menu items read.
 * Kept out of typed-editing.ts so this module exports only components (Fast
 * Refresh).
 */
export function TypedDeleteButton() {
  const Components = useComponentsContext();
  const editor = useBlockNoteEditor();
  const hovered = useExtensionState(SideMenuExtension, {
    selector: (state: { block?: BlockLike } | undefined) => state?.block,
  }) as BlockLike | undefined;

  if (
    Components === undefined ||
    hovered === undefined ||
    !removable(hovered.type)
  ) {
    return null;
  }

  return (
    <Components.SideMenu.Button
      className="bn-button"
      label="Delete"
      icon={<Trash2 size={20} />}
      onClick={() => editor.removeBlocks([hovered.id])}
    />
  );
}
