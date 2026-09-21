import { Box } from '#/components/design-system/box.tsx';
import { Stack } from '#/components/design-system/stack';
import { Text } from '#/components/design-system/text';
import { Title } from '#/components/design-system/title';
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
