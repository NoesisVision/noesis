import { ActionIcon, IconFilter, Checkbox, Popover, Stack, Text } from '@noesis/design-system';

export const BuildingBlockFilter = () => (
  <Popover defaultOpened withinPortal={false} position="bottom-start" shadow="md" width={240}>
    <Popover.Target>
      <ActionIcon variant="default" size="lg" aria-label="Filter building blocks">
        <IconFilter size={18} />
      </ActionIcon>
    </Popover.Target>
    <Popover.Dropdown>
      <Stack gap="xs">
        <Text size="sm" fw={600}>
          Building blocks
        </Text>
        <Checkbox size="sm" label="Aggregates" defaultChecked />
        <Checkbox size="sm" label="Application services" defaultChecked />
        <Checkbox size="sm" label="Driven ports" />
      </Stack>
    </Popover.Dropdown>
  </Popover>
);
