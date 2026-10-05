import { Box, Stack, Text, Title } from '@noesis/design-system';

export const Orders = () => (
  <Stack gap={4}>
    <Title order={1}>Architecture overview</Title>
    <Title order={2}>Payment flow</Title>
    <Title order={3}>Order service</Title>
    <Title order={4}>Behaviours</Title>
    <Title order={5}>Scenarios</Title>
    <Title order={6}>Input and output</Title>
  </Stack>
);

export const ElementName = () => (
  <Title order={2} size="h3">
    PlaceOrder
  </Title>
);

export const WithDescription = () => (
  <Box maw={380}>
    <Title order={2} size="h3" mb={0}>
      Design documents
    </Title>
    <Text size="sm" c="dimmed">
      Everything the scanners and your team know about how the system is built.
    </Text>
  </Box>
);

export const LineClamp = () => (
  <Title order={4} lineClamp={1} maw={260}>
    Reserve stock when an order is placed and release it on timeout
  </Title>
);
