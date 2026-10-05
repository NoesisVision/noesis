import { Anchor, Group, Stack, Text } from '@noesis/design-system';

export const Inline = () => (
  <Text size="sm" maw={420}>
    This behaviour is described in the{' '}
    <Anchor href="#">Payment flow design document</Anchor> and covered by{' '}
    <Anchor href="#">three scenarios</Anchor>.
  </Text>
);

export const Underline = () => (
  <Stack gap="xs">
    <Anchor href="#" underline="hover">
      Open change: Split order service
    </Anchor>
    <Anchor href="#" underline="always">
      View scanner logs
    </Anchor>
    <Anchor href="#" underline="never">
      Back to elements
    </Anchor>
  </Stack>
);

export const Sizes = () => (
  <Group gap="lg" align="baseline">
    <Anchor href="#" size="xs">
      Orders
    </Anchor>
    <Anchor href="#" size="sm">
      Payments
    </Anchor>
    <Anchor href="#" size="md">
      Checkout
    </Anchor>
    <Anchor href="#" size="lg" fw={600}>
      Architecture overview
    </Anchor>
  </Group>
);

export const Colors = () => (
  <Group gap="lg">
    <Anchor href="#">Design document</Anchor>
    <Anchor href="#" c="dimmed">
      Changelog
    </Anchor>
    <Anchor href="#" c="red">
      Removed element
    </Anchor>
  </Group>
);
