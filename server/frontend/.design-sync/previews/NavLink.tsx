import {
  Box,
  IconFiles,
  IconLayoutDashboard,
  IconPencilBolt,
  IconTools,
  IconTopologyStar3,
  NavLink,
  Text,
} from '@noesis/design-system';

export const SidebarGroup = () => (
  <Box w={260}>
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
      active
      variant="filled"
    />
  </Box>
);

export const Nested = () => (
  <Box w={260}>
    <NavLink
      label="Design docs"
      leftSection={<IconPencilBolt size={22} stroke={1.6} />}
      defaultOpened
      childrenOffset={28}
    >
      <NavLink href="#" label="Payment gateway rollout" active />
      <NavLink href="#" label="Order events v2" />
      <NavLink href="#" label="Retire legacy invoicing" />
    </NavLink>
  </Box>
);

export const Variants = () => (
  <Box w={260}>
    <NavLink
      href="#"
      label="Light (default)"
      leftSection={<IconTopologyStar3 size={18} stroke={1.6} />}
      active
    />
    <NavLink
      href="#"
      label="Filled"
      leftSection={<IconTopologyStar3 size={18} stroke={1.6} />}
      active
      variant="filled"
    />
    <NavLink
      href="#"
      label="Subtle"
      leftSection={<IconTopologyStar3 size={18} stroke={1.6} />}
      active
      variant="subtle"
    />
  </Box>
);

export const States = () => (
  <Box w={260}>
    <Box px="sm" pb={4}>
      <Text size="xs" fw={600} c="dimmed" tt="uppercase">
        Documentation
      </Text>
    </Box>
    <NavLink
      href="#"
      label="System model"
      description="What the code is made of"
      leftSection={<IconTopologyStar3 size={18} stroke={1.6} />}
    />
    <NavLink
      component="button"
      label="Dev tools"
      description="For internal use"
      leftSection={<IconTools size={18} stroke={1.6} />}
    />
    <NavLink
      href="#"
      label="Documents"
      description="No change open"
      leftSection={<IconFiles size={18} stroke={1.6} />}
      disabled
    />
  </Box>
);
