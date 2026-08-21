import { SideMenuExtension } from '@blocknote/core';
import {
  DragHandleMenu,
  RemoveBlockItem,
  useExtensionState,
} from '@blocknote/react';
import {
  type BlockLike,
  removable,
} from '@/components/design-doc/typed-editing';

/**
 * Schema-aware deletion (plan §4): list members can be deleted, elements the
 * schema requires cannot. The hovered block comes from the side-menu
 * extension's state, the same source the default menu items read. Kept out
 * of typed-editing.ts so this module exports only components (Fast Refresh).
 */
export function TypedDragHandleMenu() {
  const hovered = useExtensionState(SideMenuExtension, {
    selector: (state: { block?: BlockLike } | undefined) => state?.block,
  }) as BlockLike | undefined;

  return (
    <DragHandleMenu>
      {hovered !== undefined && removable(hovered.type) ? (
        <RemoveBlockItem>Delete</RemoveBlockItem>
      ) : (
        <div className="px-3 py-1.5 text-xs text-muted-foreground">
          Required by the schema
        </div>
      )}
    </DragHandleMenu>
  );
}
