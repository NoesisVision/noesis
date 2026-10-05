import { Checkbox, Stack } from '@noesis/design-system';

export const BuildingBlockTypes = () => (
  <Stack gap="xs">
    <Checkbox size="sm" label="Aggregate" defaultChecked />
    <Checkbox size="sm" label="Application service" defaultChecked />
    <Checkbox size="sm" label="Driven port" />
    <Checkbox size="sm" label="Domain event" indeterminate />
  </Stack>
);

export const States = () => (
  <Stack gap="xs">
    <Checkbox label="Show changes only" />
    <Checkbox label="Include removed elements" defaultChecked />
    <Checkbox label="Undrawn kinds" disabled />
    <Checkbox label="Modules" disabled defaultChecked />
  </Stack>
);
