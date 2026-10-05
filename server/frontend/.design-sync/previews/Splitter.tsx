import {
  Badge,
  Box,
  Group,
  NavLink,
  Splitter,
  Stack,
  Text,
  Title,
} from '@noesis/design-system';

const paneStyle = { padding: 16, overflow: 'auto' } as const;

export const DesignDocColumns = () => (
  <Box
    h={260}
    style={{
      border: '1px solid var(--mantine-color-default-border)',
      borderRadius: 'var(--mantine-radius-sm)',
    }}
  >
    <Splitter
      attributes={{ handle: { 'aria-label': 'Resize the columns' } }}
      lineSize={4}
      style={{ height: '100%' }}
    >
      <Splitter.Pane defaultSize={35} min="12rem" style={paneStyle}>
        <Text size="xs" fw={600} c="dimmed" tt="uppercase" mb={4}>
          Outline
        </Text>
        <NavLink href="#" label="Context" />
        <NavLink href="#" label="Place order" active />
        <NavLink href="#" label="Refund order" />
        <NavLink href="#" label="Open questions" />
      </Splitter.Pane>
      <Splitter.Pane defaultSize={65} min="16rem" style={paneStyle}>
        <Stack gap="xs">
          <Group gap="xs">
            <Title order={4}>Place order</Title>
            <Badge variant="light">Command</Badge>
          </Group>
          <Text size="sm">
            Takes a basket and a payment method, reserves stock and emits
            OrderPlacedEvent once the payment gateway confirms.
          </Text>
          <Text size="sm" c="dimmed">
            Input: PlaceOrderCommand · Output: OrderPlacedEvent
          </Text>
        </Stack>
      </Splitter.Pane>
    </Splitter>
  </Box>
);

export const Vertical = () => (
  <Box
    h={260}
    style={{
      border: '1px solid var(--mantine-color-default-border)',
      borderRadius: 'var(--mantine-radius-sm)',
    }}
  >
    <Splitter orientation="vertical" style={{ height: '100%' }}>
      <Splitter.Pane defaultSize={60} style={paneStyle}>
        <Title order={5} mb={4}>
          Scenario: refund after partial shipment
        </Title>
        <Text size="sm">
          Given an order with two parcels, when one is returned, then the
          refund covers only the returned items.
        </Text>
      </Splitter.Pane>
      <Splitter.Pane defaultSize={40} style={paneStyle}>
        <Text size="sm" c="dimmed">
          Scanner output: 3 behaviours, 5 elements matched.
        </Text>
      </Splitter.Pane>
    </Splitter>
  </Box>
);

export const ThreePanesColoredHandle = () => (
  <Box
    h={200}
    style={{
      border: '1px solid var(--mantine-color-default-border)',
      borderRadius: 'var(--mantine-radius-sm)',
    }}
  >
    <Splitter handleColor="brand" withHandle style={{ height: '100%' }}>
      <Splitter.Pane defaultSize={25} style={paneStyle}>
        <Text size="sm" fw={600}>Changes</Text>
      </Splitter.Pane>
      <Splitter.Pane defaultSize={45} style={paneStyle}>
        <Text size="sm" fw={600}>Design document</Text>
      </Splitter.Pane>
      <Splitter.Pane defaultSize={30} style={paneStyle}>
        <Text size="sm" fw={600}>Elements</Text>
      </Splitter.Pane>
    </Splitter>
  </Box>
);
