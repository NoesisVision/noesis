import {
  ModelTree,
  type TreeInactive,
  type TreeMoving,
  type TreeToggling,
} from '#/features/design-docs/ui/model-tree/model-tree.tsx';
import type { ModelTreeController } from '#/features/design-docs/ui/model-tree/use-model-tree.ts';
import { Box } from '#/shared/design-system/box.tsx';
import { Text } from '#/shared/design-system/text.tsx';

export function Outline({
  controller,
  label = 'Design outline',
  empty = 'This design names no elements yet.',
  nothingFound = 'Nothing in this design is called that.',
  moving,
  toggling,
  inactive,
}: {
  controller: ModelTreeController;
  /** What the tree is of, for a reader who arrives at it by keyboard. */
  label?: string;
  /** What the tree says when the design gives it no rows, in the words of what it lists. */
  empty?: string;
  /** What the tree says when the search finds no row. */
  nothingFound?: string;
  /** Rows that may be dragged to another parent; none where the tree is read only. */
  moving?: TreeMoving;
  /** Rows whose element can be put in or taken out of a view; none where nothing can. */
  toggling?: TreeToggling;
  /** Rows shown but not to be picked; see the tree's own. */
  inactive?: TreeInactive;
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
        <Text c="dimmed">{nothingFound}</Text>
      </Box>
    );
  }
  return (
    <ModelTree
      controller={controller}
      label={label}
      moving={moving}
      toggling={toggling}
      inactive={inactive}
    />
  );
}
