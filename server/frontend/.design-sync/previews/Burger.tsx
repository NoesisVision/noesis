import { Burger, Group, Stack, Text } from '@noesis/design-system';

export const ShellHeader = () => (
  <Group gap="sm" px="md" py="xs" w={320} style={{ borderBottom: '1px solid var(--mantine-color-gray-3)' }}>
    <Burger opened={false} size="sm" aria-label="Toggle navigation" />
    <Text fw={600}>Noesis</Text>
  </Group>
);

export const States = () => (
  <Group gap="xl">
    <Stack gap={4} align="center">
      <Burger opened={false} aria-label="Open navigation" />
      <Text size="xs" c="dimmed">Closed</Text>
    </Stack>
    <Stack gap={4} align="center">
      <Burger opened aria-label="Close navigation" />
      <Text size="xs" c="dimmed">Opened</Text>
    </Stack>
  </Group>
);

export const Sizes = () => (
  <Group gap="lg" align="center">
    {(['xs', 'sm', 'md', 'lg', 'xl'] as const).map((size) => (
      <Burger key={size} size={size} opened={false} aria-label={`Toggle navigation ${size}`} />
    ))}
  </Group>
);

export const Colored = () => (
  <Group gap="lg">
    <Burger color="brand" aria-label="Toggle navigation" opened={false} />
    <Burger color="gray" lineSize={2} aria-label="Toggle navigation" opened={false} />
  </Group>
);
