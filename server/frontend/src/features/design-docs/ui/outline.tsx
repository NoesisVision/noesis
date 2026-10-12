import {
  ModelTree,
  type TreeMoving,
} from '#/features/design-docs/ui/model-tree/model-tree.tsx';
import type { ModelTreeController } from '#/features/design-docs/ui/model-tree/use-model-tree.ts';
import { Box } from '#/shared/design-system/box.tsx';
import { Text } from '#/shared/design-system/text.tsx';

export function Outline({
  controller,
  label = 'Design outline',
  empty = 'This design names no elements yet.',
  moving,
}: {
  controller: ModelTreeController;
  /** What the tree is of, for a reader who arrives at it by keyboard. */
  label?: string;
  /** What the tree says when the design gives it no rows, in the words of what it lists. */
  empty?: string;
  /** Rows that may be dragged to another parent; none where the tree is read only. */
  moving?: TreeMoving;
}) {
  if (controller.tree.nodes.length === 0)
    return (
      <Box pt="md">
        <Text c="dimmed">{empty}</Text>
      </Box>
    );
  if (controller.search.active && controller.search.matched.size === 0) {
    return (
      <Box pt="md">
        <Text c="dimmed">Nothing in this design is called that.</Text>
      </Box>
    );
  }
  return <ModelTree controller={controller} label={label} moving={moving} />;
}
