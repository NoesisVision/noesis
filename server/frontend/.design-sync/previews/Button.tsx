import { Button, Group, IconPlus, IconRefresh } from '@noesis/design-system';

export const Variants = () => (
  <Group gap="sm">
    <Button>Create document</Button>
    <Button variant="default">Try again</Button>
    <Button variant="light">Review changes</Button>
    <Button variant="outline">Export</Button>
    <Button variant="subtle">Cancel</Button>
  </Group>
);

export const Sizes = () => (
  <Group gap="sm" align="center">
    <Button size="xs">Extra small</Button>
    <Button size="sm">Small</Button>
    <Button size="md">Medium</Button>
    <Button variant="subtle" size="compact-sm">
      Compact breadcrumb step
    </Button>
  </Group>
);

export const WithSections = () => (
  <Group gap="sm">
    <Button leftSection={<IconPlus size={16} />}>New change</Button>
    <Button variant="default" rightSection={<IconRefresh size={16} />}>
      Reload
    </Button>
  </Group>
);

export const States = () => (
  <Group gap="sm">
    <Button busy>Saving</Button>
    <Button disabled>Publish</Button>
    <Button color="red">Delete change</Button>
  </Group>
);
