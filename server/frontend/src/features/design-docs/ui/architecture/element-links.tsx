import type { OutlineTree } from '#/features/design-docs/ui/model-tree/outline-tree.ts';
import { addressOf } from '../../element-id.ts';
import { NoteSection } from '../element-details/body/sections/note-section.tsx';
import { ElementRelations } from '../element-details/element-relations.tsx';

/**
 * The elements something is about, each a way to it, in the box the model
 * lists what a block implements in; or a word on why there are none.
 */
export function ElementLinks({
  title,
  ids,
  modelTree,
  empty,
}: {
  title: string;
  ids: string[];
  /** The model's own tree, where each element finds its row and its kind. */
  modelTree: OutlineTree;
  empty?: string | undefined;
}) {
  if (ids.length === 0)
    return empty === undefined ? null : <NoteSection>{empty}</NoteSection>;
  return (
    <ElementRelations
      relations={[
        {
          label: title,
          items: ids.map((id) => ({
            change: modelTree.byPath.get(id)?.change ?? 'unchanged',
            label: addressOf(id),
            path: id,
          })),
        },
      ]}
      tree={modelTree}
      flush
    />
  );
}
