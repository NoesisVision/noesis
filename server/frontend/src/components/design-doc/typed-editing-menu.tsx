import { SideMenuExtension } from '@blocknote/core';
import { RemoveBlockItem, useExtensionState } from '@blocknote/react';
import { Trash2 } from 'lucide-react';
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

  if (hovered !== undefined && removable(hovered.type)) {
    return (
      <RemoveBlockItem>
        <span className="cursor-pointer inline-block hover:bg-muted">
          <Trash2 size={20} />
        </span>
      </RemoveBlockItem>
    );
  }
  return null;
}
