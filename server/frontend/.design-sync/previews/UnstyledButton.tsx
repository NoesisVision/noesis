import { Box, Group, IconChevronDown, IconFileText, Stack, Text, ThemeIcon, UnstyledButton } from '@noesis/design-system';

export const ChangePicker = () => (
  <UnstyledButton
    aria-label="Switch change"
    w={300}
    px={12}
    py={14}
    style={{
      display: 'block',
      border: '1px solid var(--mantine-color-gray-4)',
      borderRadius: 'var(--mantine-radius-md)',
      background: 'var(--mantine-color-white)',
    }}
  >
    <Group gap={10} wrap="nowrap" align="stretch">
      <Box mih={24} w={8} bg="var(--mantine-color-teal-5)" style={{ flex: 'none', borderRadius: 2 }} />
      <Box style={{ flex: 1, minWidth: 0 }}>
        <Text size="sm" fw={600} truncate lh={1.3}>
          Split order read model
        </Text>
        <Text size="xs" c="dimmed" ff="monospace" lh={1.4}>
          CHG-142
        </Text>
      </Box>
      <IconChevronDown size={16} stroke={1.6} color="var(--mantine-color-dimmed)" />
    </Group>
  </UnstyledButton>
);

export const DocumentRows = () => (
  <Stack gap={2} w={300}>
    {[
      ['Payment flow', 'Updated 2 days ago'],
      ['Order service', 'Updated last week'],
      ['Inventory sync', 'Draft'],
    ].map(([name, meta], i) => (
      <UnstyledButton
        key={name}
        p="xs"
        style={{
          borderRadius: 'var(--mantine-radius-sm)',
          background: i === 0 ? 'var(--mantine-color-brand-light)' : undefined,
        }}
      >
        <Group gap="sm" wrap="nowrap">
          <ThemeIcon variant="light" size="md">
            <IconFileText size={18} stroke={1.6} />
          </ThemeIcon>
          <div>
            <Text size="sm" fw={500}>
              {name}
            </Text>
            <Text size="xs" c="dimmed">
              {meta}
            </Text>
          </div>
        </Group>
      </UnstyledButton>
    ))}
  </Stack>
);
