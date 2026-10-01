import { Badge, Group, Stack, Text } from '@noesis/design-system';

export const ChangeKinds = () => (
  <Group gap="xs">
    <Badge color="green" variant="light" size="xs">
      added
    </Badge>
    <Badge color="cyan" variant="light" size="xs">
      modified
    </Badge>
    <Badge color="red" variant="light" size="xs">
      removed
    </Badge>
  </Group>
);

export const ChangeTypeAndStatus = () => (
  <Stack gap={4}>
    <Text size="sm" fw={600}>
      Split order service
    </Text>
    <Group gap={6} wrap="nowrap">
      <Badge size="xs" variant="outline" color="green">
        feature
      </Badge>
      <Badge size="xs" variant="light" color="brand">
        Implementation
      </Badge>
    </Group>
    <Group gap={6} wrap="nowrap">
      <Badge size="xs" variant="outline" color="red">
        fix
      </Badge>
      <Badge size="xs" variant="light" color="violet">
        Design
      </Badge>
    </Group>
    <Group gap={6} wrap="nowrap">
      <Badge size="xs" variant="outline" color="gray">
        chore
      </Badge>
      <Badge size="xs" variant="light" color="gray">
        Discovery
      </Badge>
    </Group>
  </Stack>
);

export const Variants = () => (
  <Group gap="xs">
    <Badge>Draft</Badge>
    <Badge variant="light">Draft</Badge>
    <Badge variant="outline">Draft</Badge>
    <Badge variant="dot">Draft</Badge>
    <Badge variant="default">Draft</Badge>
    <Badge variant="transparent">Draft</Badge>
  </Group>
);

export const Sizes = () => (
  <Group gap="xs" align="center">
    {(['xs', 'sm', 'md', 'lg', 'xl'] as const).map((size) => (
      <Badge key={size} size={size} variant="light">
        Scenario
      </Badge>
    ))}
  </Group>
);

export const Visibility = () => (
  <Group gap="xs">
    <Badge variant="outline" size="xs" color="gray">
      private
    </Badge>
    <Badge variant="outline" size="xs" color="brand">
      public
    </Badge>
    <Badge size="xs" variant="default">
      behaviour
    </Badge>
  </Group>
);
