import { Card, Center, IconArrowDown, Stack, Text, ThemeIcon } from '@noesis/design-system';

export const StepSeparator = () => (
  <Stack gap={0} maw={360}>
    <Card padding="sm">
      <Text size="sm">Given a customer with a saved card</Text>
    </Card>
    <Center my={8}>
      <ThemeIcon variant="light">
        <IconArrowDown aria-hidden />
      </ThemeIcon>
    </Center>
    <Card padding="sm">
      <Text size="sm">When the checkout is submitted</Text>
    </Card>
  </Stack>
);

export const EmptyState = () => (
  <Card withBorder maw={360}>
    <Center h={120}>
      <Stack gap={4} align="center">
        <Text fw={600}>No design documents yet</Text>
        <Text size="sm" c="dimmed">
          Run a scanner to populate this change.
        </Text>
      </Stack>
    </Center>
  </Card>
);

export const Inline = () => (
  <Center inline>
    <ThemeIcon variant="light" size="sm" mr={6}>
      <IconArrowDown size={14} aria-hidden />
    </ThemeIcon>
    <Text size="sm">Jump to scenarios</Text>
  </Center>
);
