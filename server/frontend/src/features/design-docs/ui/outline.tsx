import { Box } from '#/shared/design-system/box.tsx';
import { Text } from '#/shared/design-system/text.tsx';
import { ModelTree } from '#/shared/ui/model-tree/model-tree.tsx';
import type { ModelTreeController } from '#/shared/ui/model-tree/use-model-tree.ts';

export function Outline({
  controller,
  empty,
  label = 'Design outline',
}: {
  controller: ModelTreeController;
  empty: boolean;
  /** What the tree is of, for a reader who arrives at it by keyboard. */
  label?: string;
}) {
  if (empty)
    return (
      <Box pt="md">
        <Text c="dimmed">This design names no elements yet.</Text>
      </Box>
    );
  if (controller.search.active && controller.search.matched.size === 0) {
    return (
      <Box pt="md">
        <Text c="dimmed">Nothing in this design is called that.</Text>
      </Box>
    );
  }
  return <ModelTree controller={controller} label={label} />;
}
