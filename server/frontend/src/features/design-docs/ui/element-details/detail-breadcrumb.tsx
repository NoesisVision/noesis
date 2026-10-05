import type { OutlineNode } from '#/features/design-docs/ui/model-tree/model-outline.ts';
import { Box } from '#/shared/design-system/box.tsx';
import { Breadcrumbs } from '#/shared/design-system/breadcrumbs.tsx';
import { Button } from '#/shared/design-system/button.tsx';
import { Divider } from '#/shared/design-system/divider.tsx';
import { Text } from '#/shared/design-system/text.tsx';

/**
 * The path in words, under the rails that draw it: a reader who followed a
 * search result into the middle of a deep tree can still say where they are,
 * and can step back up it.
 *
 * A landmark, because that is what a trail is. The separator between the
 * steps is hidden from assistive technology, where a reader who cannot see it
 * is not made to hear it; the element itself closes the trail as the current
 * location, not as a step of the way to it.
 */
export function DetailBreadcrumb({
  path,
  onSelect,
}: {
  path: readonly OutlineNode[];
  onSelect: (path: string) => void;
}) {
  const above = path.slice(0, -1);
  if (path.length === 0) return null;
  const lastItem = path[path.length - 1];
  return (
    <>
      <Box component="nav" aria-label="Where this element sits">
        <Breadcrumbs
          separator={<span aria-hidden="true">&gt;</span>}
          separatorMargin="xs"
          px="xs"
          py="xs"
        >
          {above.map((step) => (
            <Button
              variant="subtle"
              key={step.path}
              size="compact-sm"
              onClick={() => onSelect(step.path)}
            >
              {step.name}
            </Button>
          ))}
          {lastItem ? (
            <Text c="dimmed" size="xs" aria-current="location">
              {lastItem.name}
            </Text>
          ) : null}
        </Breadcrumbs>
      </Box>
      <Divider />
    </>
  );
}
