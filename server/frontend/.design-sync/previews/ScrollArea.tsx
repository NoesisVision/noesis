import { Box, NavLink, ScrollArea, Stack, Text } from '@noesis/design-system';

const ELEMENTS = [
  'BillingService',
  'InvoiceRepository',
  'PaymentGatewayClient',
  'OrderPlacedEvent',
  'CustomerAccount',
  'RefundPolicy',
  'LedgerEntry',
  'TaxCalculator',
  'NotificationDispatcher',
  'SubscriptionPlan',
  'CurrencyConverter',
  'AuditTrail',
];

export const ElementList = () => (
  <Box
    w={280}
    style={{
      border: '1px solid var(--mantine-color-default-border)',
      borderRadius: 'var(--mantine-radius-sm)',
    }}
  >
    <ScrollArea h={200} type="always" offsetScrollbars>
      {ELEMENTS.map((name, i) => (
        <NavLink key={name} href="#" label={name} active={i === 2} />
      ))}
    </ScrollArea>
  </Box>
);

export const AutosizeWithMaxHeight = () => (
  <Box
    w={320}
    p="sm"
    style={{
      border: '1px solid var(--mantine-color-default-border)',
      borderRadius: 'var(--mantine-radius-sm)',
    }}
  >
    <ScrollArea.Autosize mah={160} type="always">
      <Stack gap="xs">
        {[
          'Scanner "spring-beans" found 42 elements.',
          'Scanner "kafka-topics" found 7 elements.',
          'Behaviour "Place order" now emits OrderPlacedEvent.',
          'Scenario "Refund after partial shipment" added.',
          'Design doc "Order events v2" approved.',
          'Element "LegacyInvoicer" marked for removal.',
          'Change "Split billing scanner" opened.',
        ].map((line) => (
          <Text key={line} size="sm">
            {line}
          </Text>
        ))}
      </Stack>
    </ScrollArea.Autosize>
  </Box>
);

export const Horizontal = () => (
  <ScrollArea
    w={320}
    type="always"
    scrollbars="x"
    offsetScrollbars
    style={{
      border: '1px solid var(--mantine-color-default-border)',
      borderRadius: 'var(--mantine-radius-sm)',
    }}
  >
    <Box w={640} p="sm">
      <Text size="sm" style={{ whiteSpace: 'nowrap' }}>
        OrderController → OrderService → PaymentGatewayClient → LedgerEntry →
        NotificationDispatcher → AuditTrail
      </Text>
    </Box>
  </ScrollArea>
);
