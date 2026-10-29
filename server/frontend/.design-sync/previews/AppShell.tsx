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
  IconSettings,
  IconTopologyStar3,
  NavLink,
  ScrollArea,
  Stack,
  Text,
  Title,
} from '@noesis/design-system';

/*
 * The brand book v4 mark, as the app's top bar draws it
 * (src/shell/noesis-mark.tsx, which is not a design-system module, so it is
 * drawn here): a hexagon with the N as a small graph, on a 24-unit grid, in
 * the mark's colour — navy in light, cyan in dark.
 */
const NoesisMark = () => (
  <svg
    width={24}
    height={24}
    viewBox="0 0 24 24"
    fill="none"
    stroke="var(--noesis-brand-mark)"
    strokeLinejoin="round"
    strokeLinecap="round"
    aria-hidden
    style={{ display: 'block', flex: 'none' }}
  >
    <path
      d="M12 1.75L20.75 6.75V17.25L12 22.25L3.25 17.25V6.75Z"
      strokeWidth={1.5}
    />
    <path d="M8.5 15.5V8.5L15.5 15.5V8.5" strokeWidth={1.5} />
    <g fill="var(--noesis-brand-mark)" stroke="none">
      <circle cx={8.5} cy={8.5} r={1.5} />
      <circle cx={8.5} cy={15.5} r={1.5} />
      <circle cx={15.5} cy={8.5} r={1.5} />
      <circle cx={15.5} cy={15.5} r={1.5} />
    </g>
  </svg>
);

export const ShellLayout = () => (
  <AppShell
    mode="static"
    header={{ height: 56 }}
    navbar={{ width: 280, breakpoint: 'xs' }}
    padding="lg"
    h={460}
  >
    <AppShell.Header bg="var(--noesis-rail-background)">
      <Group h="100%" px="md" justify="space-between">
        <Group gap="sm">
          <Burger opened={false} hiddenFrom="xs" size="sm" aria-label="Toggle navigation" />
          <Group gap={7}>
            <NoesisMark />
            <Text fw={600} fz={18} lh={1}>
              Noesis
            </Text>
          </Group>
        </Group>
        <ActionIcon
          variant="subtle"
          color="gray"
          size={34}
          aria-label="App settings"
        >
          <IconSettings size={18} stroke={1.7} />
        </ActionIcon>
      </Group>
    </AppShell.Header>
    <AppShell.Navbar bg="var(--noesis-rail-background)">
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
          <Text fw={600}>Behavior: Place order</Text>
          <Text size="sm" c="dimmed">
            Input: PlaceOrderCommand · Output: OrderPlacedEvent
          </Text>
        </Card>
      </Stack>
    </AppShell.Main>
  </AppShell>
);
