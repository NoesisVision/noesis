import {
  Badge,
  Card,
  Group,
  IconFileText,
  Stack,
  Text,
  ThemeIcon,
  Title,
} from '@noesis/design-system';

export const Basic = () => (
  <Card maw={360}>
    <Stack gap="xs">
      <Title order={4}>Architecture overview</Title>
      <Text size="sm" c="dimmed">
        How the scanners, the knowledge graph and the design documents fit
        together, and which service owns each piece of state.
      </Text>
    </Stack>
  </Card>
);

export const DocumentLink = () => (
  <Card component="a" href="#" padding="lg" maw={420}>
    <Stack gap={4}>
      <Group gap="sm" wrap="nowrap">
        <ThemeIcon variant="light" size="lg">
          <IconFileText size={20} />
        </ThemeIcon>
        <div>
          <Title order={3} size="h5">
            Payment flow
          </Title>
          <Text size="xs" c="dimmed">
            Design document · updated 2 days ago
          </Text>
        </div>
      </Group>
      <Text size="sm">
        Covers checkout, refunds and the retry policy for the card provider.
      </Text>
    </Stack>
  </Card>
);

export const WithSection = () => (
  <Card padding="md" maw={360}>
    <Card.Section withBorder inheritPadding py="xs">
      <Group justify="space-between">
        <Text fw={600}>Pending change</Text>
        <Badge variant="light">Draft</Badge>
      </Group>
    </Card.Section>
    <Text size="sm" mt="sm">
      Split the order service into read and write models so reporting no
      longer blocks checkout.
    </Text>
  </Card>
);
