import {
  IconArrowsMaximize,
  IconArrowsMinimize,
  IconCheck,
  IconDeviceDesktop,
  IconMoon,
  IconSettings,
  IconSun,
} from '@tabler/icons-react';
import { use } from 'react';
import noesisLogo from '#/noesis.png';
import { ActionIcon } from '#/shared/design-system/action-icon';
import { Burger } from '#/shared/design-system/burger';
import {
  type MantineColorScheme,
  useMantineColorScheme,
} from '#/shared/design-system/color-scheme';
import { Group } from '#/shared/design-system/group';
import { useDisclosure } from '#/shared/design-system/hooks.ts';
import { Menu } from '#/shared/design-system/menu';
import { Text } from '#/shared/design-system/text';
import { Tooltip } from '#/shared/design-system/tooltip';
import { useDevToolsContext } from '#/shared/dev-tools/dev-tools-context.tsx';
import { ShellFullscreenContext } from '#/shared/ui/shell-fullscreen.tsx';
import { APP_PUBLIC_NAV } from '#/shell/navigation/nav-items.ts';
import { DevToolsDialog } from './dev-tools-dialog.tsx';
import classes from './top-bar.module.css';

interface TopBarProps {
  navbarOpened: boolean;
  onToggleNavbar: () => void;
}

/**
 * The app's own controls, apart from the change you are in: the name on the
 * left, over the rail; full screen and settings on the right. Below `md` the
 * burger opens the rail, which is folded away there.
 */
export function TopBar({ navbarOpened, onToggleNavbar }: TopBarProps) {
  return (
    <Group
      h="100%"
      pl="md"
      pr="sm"
      gap="sm"
      wrap="nowrap"
      className={classes.bar}
    >
      <Burger
        opened={navbarOpened}
        onClick={onToggleNavbar}
        hiddenFrom="md"
        size="sm"
        aria-label="Toggle navigation"
      />
      <Group gap={10} wrap="nowrap" className={classes.brand}>
        <img src={noesisLogo} alt="" width={22} height={22} />
        <Text fw={700}>Noesis</Text>
      </Group>
      <Group gap={2} wrap="nowrap" ml="auto">
        <FullscreenTool />
        <DevToolsTool />
        <SettingsTool />
      </Group>
    </Group>
  );
}

function FullscreenTool() {
  const { fullscreen, toggle } = use(ShellFullscreenContext);
  const label = fullscreen ? 'Exit full screen' : 'Full screen';
  const Icon = fullscreen ? IconArrowsMinimize : IconArrowsMaximize;
  return (
    <Tooltip label={label}>
      <ActionIcon
        variant="subtle"
        color="gray"
        size={34}
        radius="md"
        aria-label={label}
        onClick={toggle}
      >
        <Icon size={18} stroke={1.7} aria-hidden />
      </ActionIcon>
    </Tooltip>
  );
}

/** Dev tools, for internal use: a tool of the bar's own, while enabled. */
function DevToolsTool() {
  const { enabled } = useDevToolsContext();
  const [opened, dialog] = useDisclosure(false);
  if (!enabled) return null;
  return (
    <>
      {APP_PUBLIC_NAV.devTools.map((entry) => (
        <Tooltip key={entry.to} label={entry.label}>
          <ActionIcon
            variant="subtle"
            color="gray"
            size={34}
            radius="md"
            aria-label={entry.label}
            onClick={dialog.open}
          >
            <entry.icon size={18} stroke={1.7} aria-hidden />
          </ActionIcon>
        </Tooltip>
      ))}
      <DevToolsDialog opened={opened} onClose={dialog.close} />
    </>
  );
}

const SCHEMES: {
  value: MantineColorScheme;
  label: string;
  icon: typeof IconSun;
}[] = [
  { value: 'light', label: 'Light', icon: IconSun },
  { value: 'dark', label: 'Dark', icon: IconMoon },
  { value: 'auto', label: 'System', icon: IconDeviceDesktop },
];

/** The app's settings; for now, its colour scheme. */
function SettingsTool() {
  const { colorScheme, setColorScheme } = useMantineColorScheme();
  return (
    <Menu position="bottom-end" shadow="md" width={180}>
      <Menu.Target>
        <ActionIcon
          variant="subtle"
          color="gray"
          size={34}
          radius="md"
          aria-label="App settings"
          title="App settings"
        >
          <IconSettings size={18} stroke={1.7} aria-hidden />
        </ActionIcon>
      </Menu.Target>
      <Menu.Dropdown>
        <Menu.Label>Colour scheme</Menu.Label>
        {SCHEMES.map((scheme) => (
          <Menu.Item
            key={scheme.value}
            leftSection={<scheme.icon size={16} />}
            rightSection={
              scheme.value === colorScheme ? <IconCheck size={14} /> : null
            }
            onClick={() => setColorScheme(scheme.value)}
          >
            {scheme.label}
          </Menu.Item>
        ))}
      </Menu.Dropdown>
    </Menu>
  );
}
