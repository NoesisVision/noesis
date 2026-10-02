import {
  ActionIcon,
  IconCheck,
  IconDeviceDesktop,
  IconMoon,
  IconSun,
  IconTrash,
  Menu,
} from '@noesis/design-system';

export const ColourSchemeMenu = () => (
  <Menu
    defaultOpened
    withinPortal={false}
    position="bottom-start"
    shadow="md"
    width={180}
  >
    <Menu.Target>
      <ActionIcon variant="default" size="lg" aria-label="Colour scheme">
        <IconSun size={18} />
      </ActionIcon>
    </Menu.Target>
    <Menu.Dropdown>
      <Menu.Label>Colour scheme</Menu.Label>
      <Menu.Item
        leftSection={<IconSun size={16} />}
        rightSection={<IconCheck size={14} />}
      >
        Light
      </Menu.Item>
      <Menu.Item leftSection={<IconMoon size={16} />}>Dark</Menu.Item>
      <Menu.Item leftSection={<IconDeviceDesktop size={16} />}>
        System
      </Menu.Item>
      <Menu.Divider />
      <Menu.Item color="red" leftSection={<IconTrash size={16} />}>
        Reset preferences
      </Menu.Item>
    </Menu.Dropdown>
  </Menu>
);
