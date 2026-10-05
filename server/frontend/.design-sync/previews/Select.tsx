import { Select, Stack } from '@noesis/design-system';

const TYPES = [
  { value: 'aggregate', label: 'Aggregate' },
  { value: 'entity', label: 'Entity' },
  { value: 'value_object', label: 'Value Object' },
  { value: 'domain_service', label: 'Domain Service' },
];

export const BuildingBlockType = () => (
  <Stack gap="md" w={320}>
    <Select label="Type" data={TYPES} defaultValue="aggregate" />
    <Select label="Type" data={TYPES} placeholder="Choose a type" error="Choose a type." />
  </Stack>
);

export const Opened = () => (
  <Select
    w={320}
    label="Type"
    data={TYPES}
    defaultValue="entity"
    defaultDropdownOpened
    comboboxProps={{ withinPortal: false }}
  />
);
