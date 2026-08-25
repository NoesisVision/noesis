import { SideMenuExtension } from '@blocknote/core';
import {
  RemoveBlockItem,
  useComponentsContext,
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
 *
 * Content must sit inside `Menu.Dropdown` (the library's own DragHandleMenu
 * does the same) — without it, the drag-handle's Menu.Root has no Popup to
 * host Base UI's dismiss-on-outside-click handling, so a stray click (as
 * opposed to a drag) on the handle freezes the side menu via
 * DragHandleButton's onOpenChange→freezeMenu with nothing left to unfreeze
 * it, permanently hiding .bn-side-menu for the rest of the session.
 */
export function TypedDragHandleMenu() {
  const Components = useComponentsContext();
  const hovered = useExtensionState(SideMenuExtension, {
    selector: (state: { block?: BlockLike } | undefined) => state?.block,
  }) as BlockLike | undefined;

  if (
    Components !== undefined &&
    hovered !== undefined &&
    removable(hovered.type)
  ) {
    return (
      <Components.Generic.Menu.Dropdown className="bn-menu-dropdown bn-drag-handle-menu">
        <RemoveBlockItem>Delete</RemoveBlockItem>
      </Components.Generic.Menu.Dropdown>
    );
  }
  return null;
}
