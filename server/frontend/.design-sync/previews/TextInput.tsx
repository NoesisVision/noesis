import { ActionIcon, Group, IconChevronsUpDown, IconSearch, IconX, Stack, Text, TextInput } from '@noesis/design-system';

export const OutlineSearch = () => (
  <Stack gap={4} w={340}>
    <Group gap="xs" wrap="nowrap" align="flex-start">
      <TextInput
        size="sm"
        style={{ flex: 1 }}
        aria-label="Search the outline"
        placeholder="Search names and patterns"
        defaultValue="service"
        leftSection={<IconSearch size={16} stroke={1.6} aria-hidden />}
        rightSection={
          <ActionIcon variant="subtle" size="sm" aria-label="Clear the search">
            <IconX size={14} stroke={1.6} aria-hidden />
          </ActionIcon>
        }
      />
      <ActionIcon variant="default" size="input-sm" aria-label="Expand everything">
        <IconChevronsUpDown size={18} stroke={1.6} aria-hidden />
      </ActionIcon>
    </Group>
    <Text component="output" size="xs" c="dimmed">
      12 of 87 elements
    </Text>
  </Stack>
);

export const WithLabel = () => (
  <Stack gap="md" w={320}>
    <TextInput label="Document name" placeholder="Payment flow" />
    <TextInput
      label="Repository URL"
      description="The scanner clones this repository on every push."
      placeholder="git@github.com:acme/orders.git"
      withAsterisk
    />
  </Stack>
);

export const States = () => (
  <Stack gap="md" w={320}>
    <TextInput label="Change key" defaultValue="CHG-142" />
    <TextInput label="Change key" defaultValue="CHG 142" error="Keys look like CHG-123" />
    <TextInput label="Element path" defaultValue="orders/PlaceOrder" disabled />
  </Stack>
);

export const Sizes = () => (
  <Stack gap="sm" w={320}>
    {(['xs', 'sm', 'md', 'lg'] as const).map((size) => (
      <TextInput key={size} size={size} placeholder={`Search scenarios (${size})`} />
    ))}
  </Stack>
);
