import {
  Badge,
  Button,
  Card,
  Group,
  IconPlus,
  MantineProvider,
  Stack,
  Text,
  Title,
  theme,
} from '@noesis/design-system';

const ChangeCard = () => (
  <Card withBorder padding="md" radius="sm" w={360}>
    <Stack gap="xs">
      <Group justify="space-between">
        <Title order={4}>Split billing scanner</Title>
        <Badge variant="light">In progress</Badge>
      </Group>
      <Text size="sm" c="dimmed">
        3 design documents · 12 elements touched
      </Text>
      <Group gap="sm">
        <Button size="xs" leftSection={<IconPlus size={14} />}>
          New design doc
        </Button>
        <Button size="xs" variant="default">
          Open change
        </Button>
      </Group>
    </Stack>
  </Card>
);

export const LightScheme = () => (
  <MantineProvider theme={theme} forceColorScheme="light">
    <ChangeCard />
  </MantineProvider>
);

export const DarkScheme = () => (
  <MantineProvider
    theme={theme}
    forceColorScheme="dark"
    cssVariablesSelector="#noesis-dark-scope"
    deduplicateCssVariables={false}
    withGlobalClasses={false}
    getRootElement={() =>
      document.getElementById('noesis-dark-scope') ?? undefined
    }
  >
    <div
      id="noesis-dark-scope"
      data-mantine-color-scheme="dark"
      style={{
        background: 'var(--mantine-color-body)',
        color: 'var(--mantine-color-text)',
        padding: 16,
        borderRadius: 4,
      }}
    >
      <ChangeCard />
    </div>
  </MantineProvider>
);
