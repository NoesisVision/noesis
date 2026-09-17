import { useActiveRoute } from '#/components/core/useActiveRoute.ts';
import { Box } from '#/components/design-system/box.tsx';
import { Stack } from '#/components/design-system/stack';
import { Text } from '#/components/design-system/text';
import { Title } from '#/components/design-system/title';

export function ViewHeader() {
  const { activeRoute } = useActiveRoute();
  const title = activeRoute?.label ?? 'Noesis';
  const description = activeRoute?.description;

  return (
    <Stack gap="xs" mb="lg">
      {/*<Crumbs />*/}
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
