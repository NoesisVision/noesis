import { Card, Code, Stack, Text } from '@noesis/design-system';

export const Inline = () => (
  <Text size="sm" maw={420}>
    The <Code>OrderPlaced</Code> event is emitted by <Code>orders.checkout</Code>{' '}
    after the payment is captured.
  </Text>
);

export const PropertySignature = () => (
  <Code block maw={420}>
    customerId?: billing.CustomerId;
  </Code>
);

export const PropertyCard = () => (
  <Stack gap={4} maw={420}>
    <Card shadow={undefined} p={0}>
      <Code px={16} py={8}>
        totalAmount
        <Text component="span" display="block" size="xs" c="dimmed">
          Sum of all line items, in the order currency
        </Text>
      </Code>
    </Card>
    <Card shadow={undefined} p={0}>
      <Code px={16} py={8}>
        placedAt
        <Text component="span" display="block" size="xs" c="dimmed">
          When the customer confirmed the order
        </Text>
      </Code>
    </Card>
  </Stack>
);

export const Colored = () => (
  <Text size="sm">
    Status: <Code color="brand.1">approved</Code> <Code color="red.1">rejected</Code>
  </Text>
);
