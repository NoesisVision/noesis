import { Box } from '#/shared/design-system/box.tsx';
import { Stack } from '#/shared/design-system/stack';
import { Text } from '#/shared/design-system/text';
import { Title } from '#/shared/design-system/title';
import { useActiveRoute } from '#/shell/navigation/use-active-route.ts';

export function ViewHeader() {
  const { activeItem } = useActiveRoute();
  const title = activeItem?.label ?? 'Noesis';
  const description = activeItem?.description;

  return (
    <Stack gap="xs" mb="lg">
      <Box>
        <Title order={2} mb={0}>
          {title}
        </Title>
        {!!description && (
          <Text size="sm" c="gray">
            {description}
          </Text>
        )}
      </Box>
    </Stack>
  );
}
