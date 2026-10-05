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

/** Right-click a card: its menu opens where the pointer is. */
export const CardContextMenu = () => (
  // Opened without a pointer it anchors to the card's corner: set beside it.
  <Menu
    defaultOpened
    withinPortal={false}
    shadow="md"
    width={150}
    position="left-start"
    offset={8}
  >
    <Menu.ContextMenu>
      <div
        style={{
          marginLeft: 166,
          width: 160,
          padding: 12,
          border: '1px solid var(--mantine-primary-color-filled)',
          borderRadius: 'var(--mantine-radius-md)',
        }}
      >
        A QDoc keeps at least one version
      </div>
    </Menu.ContextMenu>
    <Menu.Dropdown>
      <Menu.Item leftSection={<IconCheck size={14} />}>Edit…</Menu.Item>
      <Menu.Divider />
      <Menu.Item color="red" leftSection={<IconTrash size={14} />}>
        Remove…
      </Menu.Item>
    </Menu.Dropdown>
  </Menu>
);
