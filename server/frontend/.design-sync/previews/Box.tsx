import { Badge, Box, Group, Text } from '@noesis/design-system';

export const ChangeSummary = () => (
  <Group gap="sm" wrap="nowrap" maw={320}>
    <Box
      w={10}
      h={10}
      bg="brand.6"
      style={{ borderRadius: '50%', flex: 'none' }}
    />
    <Box style={{ flex: 1, minWidth: 0 }}>
      <Text size="sm" fw={600} truncate lh={1.3}>
        Split order service
      </Text>
      <Text size="xs" c="dimmed" ff="monospace" lh={1.4}>
        NOE-142
      </Text>
      <Group gap={6} mt={4} wrap="nowrap">
        <Badge size="xs" variant="outline" color="green">
          feature
        </Badge>
        <Badge size="xs" variant="light" color="brand">
          Implementation
        </Badge>
      </Group>
    </Box>
  </Group>
);

export const StyleProps = () => (
  <Box p="md" bg="gray.0" bd="1px solid gray.3" maw={360} style={{ borderRadius: 'var(--mantine-radius-sm)' }}>
    <Text fw={600} size="sm">
      payments-service
    </Text>
    <Text size="xs" c="dimmed" mt={4}>
      Scanned 12 minutes ago · 48 elements · 3 behaviours changed
    </Text>
  </Box>
);

export const AsNav = () => (
  <Box component="nav" aria-label="Sections" px="sm" py="xs" bg="brand.0" maw={360}>
    <Text size="sm" c="brand.8" fw={500}>
      Elements / Payments / Refund
    </Text>
  </Box>
);
