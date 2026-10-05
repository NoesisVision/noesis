import { Badge, Group, Stack, Text, Title } from '@noesis/design-system';

const Block = ({ label }: { label: string }) => (
  <Text
    size="sm"
    px="sm"
    py={6}
    bg="var(--mantine-color-brand-light)"
    c="var(--mantine-color-brand-light-color)"
    style={{ borderRadius: 'var(--mantine-radius-sm)' }}
  >
    {label}
  </Text>
);

export const Gaps = () => (
  <Group gap="xl" align="flex-start">
    {(['xs', 'sm', 'lg'] as const).map((gap) => (
      <Stack key={gap} gap={gap} w={140}>
        <Text size="xs" c="dimmed">
          gap="{gap}"
        </Text>
        <Block label="Order service" />
        <Block label="Payment gateway" />
        <Block label="Ledger" />
      </Stack>
    ))}
  </Group>
);

export const ElementHeader = () => (
  <Stack gap={4} maw={360}>
    <Group gap="xs">
      <Title order={2} size="h3">
        PlaceOrder
      </Title>
      <Badge variant="light">Behaviour</Badge>
    </Group>
    <Text size="sm" c="dimmed">
      Validates the basket, reserves stock and emits OrderPlaced for the
      payment scanner to pick up.
    </Text>
  </Stack>
);

export const Alignment = () => (
  <Group gap="lg" align="flex-start">
    {(['flex-start', 'center', 'flex-end'] as const).map((align) => (
      <Stack
        key={align}
        gap={6}
        align={align}
        w={140}
        p="xs"
        style={{ border: '1px dashed var(--mantine-color-gray-4)' }}
      >
        <Text size="xs" c="dimmed">
          {align}
        </Text>
        <Block label="Scanner" />
        <Block label="Design document" />
      </Stack>
    ))}
  </Group>
);
