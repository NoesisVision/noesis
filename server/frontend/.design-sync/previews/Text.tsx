import { Stack, Text } from '@noesis/design-system';

export const Sizes = () => (
  <Stack gap={4}>
    {(['xs', 'sm', 'md', 'lg', 'xl'] as const).map((size) => (
      <Text key={size} size={size}>
        Payment flow design document ({size})
      </Text>
    ))}
  </Stack>
);

export const Weights = () => (
  <Stack gap={4}>
    <Text fw={400}>Order service · regular</Text>
    <Text fw={500}>Order service · medium</Text>
    <Text fw={600}>Order service · semibold</Text>
    <Text fw={700}>Order service · bold</Text>
  </Stack>
);

export const Colors = () => (
  <Stack gap={4}>
    <Text size="sm">Reserves stock before the payment is captured.</Text>
    <Text size="sm" c="dimmed">
      Design document · updated 2 days ago
    </Text>
    <Text size="sm" c="brand">
      3 elements changed in this change
    </Text>
    <Text size="sm" c="red">
      Scanner failed: repository not reachable
    </Text>
  </Stack>
);

export const Monospace = () => (
  <Stack gap={2}>
    <Text size="sm" fw={600} lh={1.3}>
      Split order read model
    </Text>
    <Text size="xs" c="dimmed" ff="monospace" lh={1.4}>
      CHG-142
    </Text>
  </Stack>
);

export const Truncate = () => (
  <Stack gap={4} w={240}>
    <Text size="sm" truncate>
      ReserveStockWhenOrderIsPlacedAndReleaseOnTimeout
    </Text>
    <Text size="sm" lineClamp={2}>
      Covers checkout, refunds and the retry policy for the card provider,
      including what happens when the provider times out.
    </Text>
  </Stack>
);
