import { Badge, Button, Card, Group, IconPlus, Text } from '@noesis/design-system';

export const Header = () => (
  <Card padding={0} w={520}>
    <Group h={56} px="md" justify="space-between">
      <Group gap="sm">
        <Text fw={700}>Noesis</Text>
        <Badge variant="light">Split order read model</Badge>
      </Group>
      <Button size="xs" leftSection={<IconPlus size={14} />}>New change</Button>
    </Group>
  </Card>
);

export const Gaps = () => (
  <Group gap="xl">
    <Group gap={4}>
      <Badge size="sm" variant="outline">feature</Badge>
      <Badge size="sm" variant="outline">draft</Badge>
    </Group>
    <Group gap="md">
      <Badge size="sm" variant="light">feature</Badge>
      <Badge size="sm" variant="light">draft</Badge>
    </Group>
  </Group>
);

export const Justify = () => (
  <Card w={420}>
    <Group justify="space-between">
      <Text fw={600}>Pending change</Text>
      <Badge variant="light">Draft</Badge>
    </Group>
    <Group justify="flex-end" mt="md" gap="xs">
      <Button variant="default" size="xs">Discard</Button>
      <Button size="xs">Publish</Button>
    </Group>
  </Card>
);

export const Grow = () => (
  <Group grow w={420}>
    <Button variant="light">Documents</Button>
    <Button variant="light">Design docs</Button>
    <Button variant="light">Scanners</Button>
  </Group>
);
