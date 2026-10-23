import { Group, Kbd, Text } from '@noesis/design-system';

export const Single = () => <Kbd>Space</Kbd>;

export const Shortcut = () => (
  <Group gap={8} wrap="nowrap">
    <Group gap={4} wrap="nowrap">
      <Kbd size="xs">Delete</Kbd>
      <Kbd size="xs">⌫</Kbd>
    </Group>
    <Text size="xs" c="dimmed">
      Remove the selected card
    </Text>
  </Group>
);
