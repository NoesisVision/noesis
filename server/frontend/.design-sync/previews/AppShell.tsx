import {
  ActionIcon,
  AppShell,
  Badge,
  Box,
  Burger,
  Card,
  Group,
  IconFiles,
  IconLayoutDashboard,
  IconPencilBolt,
  IconSun,
  IconTopologyStar3,
  NavLink,
  ScrollArea,
  Stack,
  Text,
  ThemeIcon,
  Title,
} from '@noesis/design-system';

export const ShellLayout = () => (
  <AppShell
    mode="static"
    header={{ height: 56 }}
    navbar={{ width: 280, breakpoint: 'xs' }}
    padding="lg"
    h={460}
  >
    <AppShell.Header>
      <Group h="100%" px="md" justify="space-between">
        <Group gap="sm">
          <Burger opened={false} hiddenFrom="xs" size="sm" aria-label="Toggle navigation" />
          <ThemeIcon size={28} radius="sm">
            <IconTopologyStar3 size={18} />
          </ThemeIcon>
          <Text fw={600}>Noesis</Text>
        </Group>
        <ActionIcon variant="default" size="lg" aria-label="Colour scheme">
          <IconSun size={18} />
        </ActionIcon>
      </Group>
    </AppShell.Header>
    <AppShell.Navbar>
      <AppShell.Section px="xs" pt="md" pb="md">
        <Card withBorder padding="xs">
          <Text size="xs" c="dimmed">
            Change
          </Text>
          <Text size="sm" fw={600}>
            Split billing scanner
          </Text>
        </Card>
      </AppShell.Section>
      <AppShell.Section grow component={ScrollArea} px="xs">
        <NavLink
          href="#"
          label="Overview"
          leftSection={<IconLayoutDashboard size={22} stroke={1.6} />}
        />
        <NavLink
          href="#"
          label="Documents"
          leftSection={<IconFiles size={22} stroke={1.6} />}
        />
        <NavLink
          href="#"
          label="Design docs"
          leftSection={<IconPencilBolt size={22} stroke={1.6} />}
          defaultOpened
          childrenOffset={28}
        >
          <NavLink href="#" label="Order events v2" active variant="filled" />
          <NavLink href="#" label="Payment gateway rollout" />
        </NavLink>
      </AppShell.Section>
      <AppShell.Section
        px="xs"
        py="sm"
        style={{ borderTop: '1px solid var(--mantine-color-default-border)' }}
      >
        <Box px="sm" pb={4}>
          <Text size="xs" fw={600} c="dimmed" tt="uppercase">
            Documentation
          </Text>
        </Box>
        <NavLink
          href="#"
          label="System model"
          leftSection={<IconTopologyStar3 size={18} stroke={1.6} />}
        />
      </AppShell.Section>
    </AppShell.Navbar>
    <AppShell.Main>
      <Stack gap="sm">
        <Group gap="xs">
          <Title order={2}>Order events v2</Title>
          <Badge variant="light">In review</Badge>
        </Group>
        <Text c="dimmed">
          Replaces the polling-based order sync with OrderPlacedEvent and
          OrderShippedEvent on the orders topic.
        </Text>
        <Card withBorder>
          <Text fw={600}>Behaviour: Place order</Text>
          <Text size="sm" c="dimmed">
            Input: PlaceOrderCommand · Output: OrderPlacedEvent
          </Text>
        </Card>
      </Stack>
    </AppShell.Main>
  </AppShell>
);
