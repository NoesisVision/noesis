import { Anchor, Collapse, Stack, Text } from '@noesis/design-system';

export const RuleDescription = () => (
  <Stack gap={4} p="md" maw={320}>
    <Collapse expanded>
      <Text size="sm" c="dimmed">
        A QDoc title holds at least one character other than whitespace; a
        blank title cannot be created.
      </Text>
    </Collapse>
    <Anchor component="button" type="button" fz="xs">
      Hide
    </Anchor>
  </Stack>
);

export const Folded = () => (
  <Stack gap={4} p="md" maw={320}>
    <Collapse expanded={false}>
      <Text size="sm">Hidden</Text>
    </Collapse>
    <Anchor component="button" type="button" fz="xs">
      Show description
    </Anchor>
  </Stack>
);
