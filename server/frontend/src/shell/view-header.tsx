import { Box } from '#/shared/design-system/box.tsx';
import { Stack } from '#/shared/design-system/stack';
import { Text } from '#/shared/design-system/text';
import { Title } from '#/shared/design-system/title';
import { useActiveRoute } from '#/shell/navigation/use-active-route.ts';

export function ViewHeader() {
  const { activeItem } = useActiveRoute();
  if (!activeItem) return null;

  return (
    <Stack gap="xs" mb="lg">
      <Box>
        <Title order={2} mb={0}>
          {activeItem.label}
        </Title>
        {!!activeItem.description && (
          <Text size="sm" c="gray">
            {activeItem.description}
          </Text>
        )}
      </Box>
    </Stack>
  );
}
