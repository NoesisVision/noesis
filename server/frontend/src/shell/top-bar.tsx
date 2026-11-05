import {
  IconArrowsMaximize,
  IconArrowsMinimize,
  IconCheck,
  IconDeviceDesktop,
  IconMoon,
  IconSearch,
  IconSettings,
  IconSun,
} from '@tabler/icons-react';
import { useQuery } from '@tanstack/react-query';
import { useParams } from '@tanstack/react-router';
import { use } from 'react';
import { useAgentPanel } from '#/features/agent/agent-panel-context.tsx';
import { AgentIcon } from '#/features/agent/agent.model.ts';
import { currentProject } from '#/features/project/project.api.ts';
import { ActionIcon } from '#/shared/design-system/action-icon';
import { Box } from '#/shared/design-system/box';
import { Burger } from '#/shared/design-system/burger';
import {
  type MantineColorScheme,
  useComputedColorScheme,
  useMantineColorScheme,
} from '#/shared/design-system/color-scheme';
import { Group } from '#/shared/design-system/group';
import {
  useDisclosure,
  useHotkeys,
  useOs,
} from '#/shared/design-system/hooks.ts';
import { Kbd } from '#/shared/design-system/kbd.tsx';
import { Menu } from '#/shared/design-system/menu';
import { Text } from '#/shared/design-system/text';
import { Tooltip } from '#/shared/design-system/tooltip';
import { UnstyledButton } from '#/shared/design-system/unstyled-button';
import { useDevToolsContext } from '#/shared/dev-tools/dev-tools-context.tsx';
import { ShellFullscreenContext } from '#/shared/ui/shell-fullscreen.tsx';
import { APP_PUBLIC_NAV } from '#/shell/navigation/nav-items.ts';
import { DevToolsDialog } from './dev-tools-dialog.tsx';
import { NoesisMark } from './noesis-mark.tsx';
import { SearchDialog } from './search/search-dialog.tsx';
import classes from './top-bar.module.css';

interface TopBarProps {
  navbarOpened: boolean;
  onToggleNavbar: () => void;
}

/**
 * The app's own controls, apart from the change you are in: the app's name
 * and the project's on the left, over the rail; search in the middle; full
 * screen and settings on the right. Below `md` the
 * burger opens the rail, which is folded away there.
 */
export function TopBar({ navbarOpened, onToggleNavbar }: TopBarProps) {
  return (
    <Group
      h="100%"
      // From `md` the rail is beside the bar, and folded it is a 64px column
      // of icons (`shell-layout.tsx`): (64 - 24) / 2 puts the mark over them.
      pl={{ base: 'md', md: 20 }}
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
      <Brand />
      <SearchTool />
      <Group gap={2} wrap="nowrap">
        <AgentTool />
        <FullscreenTool />
        <DevToolsTool />
        <SettingsTool />
      </Group>
    </Group>
  );
}

/** "Noesis / project": the app, and the project it was started on. */
function Brand() {
  const { data: project } = useQuery(currentProject);
  return (
    <Group gap={8} wrap="nowrap" className={classes.brand}>
      {/* The book's lockup: a 24px mark, 0.3 of it apart from the wordmark. */}
      <Group gap={7} wrap="nowrap" className={classes.app}>
        <Box className={classes.mark}>
          <NoesisMark size={24} />
        </Box>
        <Text fw={600} fz={18} lh={1}>
          Noesis
        </Text>
      </Group>
      {project?.name && (
        <>
          <Text component="span" className={classes.slash} aria-hidden>
            /
          </Text>
          <Text fw={300} truncate className={classes.project}>
            {project.name}
          </Text>
        </>
      )}
    </Group>
  );
}

/**
 * The way into search: a field-like button centred in the bar, and ⌘K (Ctrl K
 * off a Mac) from anywhere.
 */
function SearchTool() {
  const [opened, dialog] = useDisclosure(false);
  const mac = ['macos', 'ios'].includes(useOs());
  const shortcut = mac ? '⌘K' : 'Ctrl K';
  useHotkeys([['mod+K', dialog.open]], []);
  return (
    <Box className={classes.searchSlot}>
      <UnstyledButton
        className={classes.search}
        onClick={dialog.open}
        aria-keyshortcuts="Meta+K Control+K"
        aria-haspopup="dialog"
      >
        <IconSearch size={16} stroke={1.7} aria-hidden />
        <Text
          component="span"
          size="sm"
          truncate
          className={classes.searchText}
        >
          Search changes, documents, model…
        </Text>
        <Text component="span" className={classes.shortcut} aria-hidden>
          {shortcut}
        </Text>
      </UnstyledButton>
      <SearchDialog opened={opened} onClose={dialog.close} />
    </Box>
  );
}

/**
 * The agent's panel, opened and shut from the bar, and with ⌘. (Ctrl . off a
 * Mac). Only on a change: the panel designs into the change the page is on,
 * and has nothing to do elsewhere.
 */
function AgentTool() {
  const { opened, toggle } = useAgentPanel();
  const { changeId } = useParams({ strict: false });
  const mac = ['macos', 'ios'].includes(useOs());
  const onChange = changeId !== undefined;
  useHotkeys([['mod+.', () => onChange && toggle()]], []);
  if (!onChange) return null;
  return (
    <Tooltip label={`Agent panel (${mac ? '⌘.' : 'Ctrl .'})`}>
      <ActionIcon
        variant={opened ? 'light' : 'subtle'}
        color={opened ? undefined : 'gray'}
        size={34}
        aria-label="Agent panel"
        aria-pressed={opened}
        aria-keyshortcuts="Meta+. Control+."
        onClick={toggle}
      >
        <AgentIcon size={18} stroke={1.7} aria-hidden />
      </ActionIcon>
    </Tooltip>
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

/**
 * The app's settings; for now, its colour scheme. ⌘J (Ctrl J off a Mac)
 * switches light and dark from anywhere, from System to the other of what
 * the system shows.
 */
function SettingsTool() {
  const { colorScheme, setColorScheme } = useMantineColorScheme();
  const shown = useComputedColorScheme('light');
  const mac = ['macos', 'ios'].includes(useOs());
  useHotkeys([
    ['mod+J', () => setColorScheme(shown === 'dark' ? 'light' : 'dark')],
  ]);
  return (
    <Menu position="bottom-end" shadow="md" width={180}>
      <Menu.Target>
        <ActionIcon
          variant="subtle"
          color="gray"
          size={34}
          aria-label="App settings"
          title="App settings"
          aria-keyshortcuts="Meta+J Control+J"
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
        <Menu.Divider />
        <Group justify="space-between" px="sm" py={6}>
          <Text size="xs" c="var(--noesis-secondary-text)">
            Light or dark
          </Text>
          <Kbd size="xs">{mac ? '⌘ J' : 'Ctrl J'}</Kbd>
        </Group>
      </Menu.Dropdown>
    </Menu>
  );
}
