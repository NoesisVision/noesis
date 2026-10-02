import { Group, Loader, Stack, Text } from '@noesis/design-system';

export const LoadingPanel = () => (
  <Stack align="center" gap="sm" py="lg">
    <Loader size="md" aria-hidden />
    <Text c="dimmed">Loading design documents…</Text>
  </Stack>
);

export const Types = () => (
  <Group gap="xl">
    <Loader type="oval" />
    <Loader type="bars" />
    <Loader type="dots" />
  </Group>
);

export const Sizes = () => (
  <Group gap="lg" align="center">
    <Loader size="xs" />
    <Loader size="sm" />
    <Loader size="md" />
    <Loader size="lg" />
    <Loader size="xl" />
  </Group>
);

export const Colors = () => (
  <Group gap="lg">
    <Loader />
    <Loader color="gray" />
    <Loader color="teal" />
    <Loader color="red" />
  </Group>
);
