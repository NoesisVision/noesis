import { Divider, Group, Stack, Text } from '@noesis/design-system';

export const BetweenSections = () => (
  <Stack gap="sm" maw={360}>
    <Text size="sm">Payments › Checkout › PlaceOrder</Text>
    <Divider />
    <Text size="sm" c="dimmed">
      Places an order for the items in the customer's cart.
    </Text>
  </Stack>
);

export const WithLabel = () => (
  <Stack gap="sm" maw={360}>
    <Divider label="Scenarios" labelPosition="left" />
    <Divider label="Behaviours" labelPosition="center" />
    <Divider label="Properties" labelPosition="right" />
  </Stack>
);

export const Variants = () => (
  <Stack gap="md" maw={360}>
    <Divider variant="solid" label="Solid" labelPosition="left" />
    <Divider variant="dashed" label="Dashed" labelPosition="left" />
    <Divider variant="dotted" label="Dotted" labelPosition="left" />
    <Divider size="md" color="brand" label="Brand, size md" labelPosition="left" />
  </Stack>
);

export const Vertical = () => (
  <Group gap="sm" h={24}>
    <Text size="sm">4 documents</Text>
    <Divider orientation="vertical" />
    <Text size="sm">27 elements</Text>
    <Divider orientation="vertical" />
    <Text size="sm">3 scanners</Text>
  </Group>
);
