import { Card, Code, Group, Spoiler, Stack, Text } from '@noesis/design-system';

const LONG =
  'References to the version’s content files, stored in content management; at least one is required before the version can be shared for review, and none can change once an approver has approved it.';

export const PropertyDescription = () => (
  <Card padding="sm" maw={260}>
    <Stack gap={4}>
      <Group gap={8}>
        <Code fw={600}>contentFiles</Code>
      </Group>
      <Spoiler maxHeight={38} showLabel="Show more" hideLabel="Show less">
        <Text size="sm" c="dimmed">
          {LONG}
        </Text>
      </Spoiler>
    </Stack>
  </Card>
);

export const Expanded = () => (
  <Card padding="sm" maw={260}>
    <Spoiler
      maxHeight={38}
      showLabel="Show more"
      hideLabel="Show less"
      defaultExpanded
    >
      <Text size="sm" c="dimmed">
        {LONG}
      </Text>
    </Spoiler>
  </Card>
);

export const ShortTextNoControl = () => (
  <Card padding="sm" maw={260}>
    <Spoiler maxHeight={38} showLabel="Show more" hideLabel="Show less">
      <Text size="sm" c="dimmed">
        When the version was created.
      </Text>
    </Spoiler>
  </Card>
);
