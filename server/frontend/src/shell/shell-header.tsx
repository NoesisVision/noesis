import {
  IconCheck,
  IconDeviceDesktop,
  IconMoon,
  IconSun,
} from '@tabler/icons-react';
import { ChangePicker } from '#/features/changes/ui/change-picker.tsx';
import noesisLogo from '#/noesis.png';
import { ActionIcon } from '#/shared/design-system/action-icon';
import { Box } from '#/shared/design-system/box';
import { Burger } from '#/shared/design-system/burger';
import {
  type MantineColorScheme,
  useComputedColorScheme,
  useMantineColorScheme,
} from '#/shared/design-system/color-scheme';
import { Divider } from '#/shared/design-system/divider';
import { Group } from '#/shared/design-system/group';
import { useDisclosure } from '#/shared/design-system/hooks.ts';
import { Menu } from '#/shared/design-system/menu';
import { Stack } from '#/shared/design-system/stack';
import { Text } from '#/shared/design-system/text';
import { Tooltip } from '#/shared/design-system/tooltip';
import { useDevToolsContext } from '#/shared/dev-tools/dev-tools-context.tsx';
import { APP_PUBLIC_NAV } from '#/shell/navigation/nav-items.ts';
import { useChangeNav } from '#/shell/navigation/use-change-nav.ts';
import { ChangeNav } from './change-nav.tsx';
import { DevToolsDialog } from './dev-tools-dialog.tsx';
import classes from './shell-header.module.css';

interface ShellHeaderProps {
  navbarOpened: boolean;
  onToggleNavbar: () => void;
}

/**
 * Two rows: which change you are in, and below it — from `md` up — where in
 * it you are. Below `md` the second row folds into the burger's menu.
 */
export function ShellHeader({
  navbarOpened,
  onToggleNavbar,
}: ShellHeaderProps) {
  const { changes, activeChange } = useChangeNav();
  return (
    <Stack gap={0} h="100%">
      <Group h={56} px="md" gap="sm" wrap="nowrap" justify="space-between">
        <Group gap="sm" wrap="nowrap" miw={0}>
          <Burger
            opened={navbarOpened}
            onClick={onToggleNavbar}
            hiddenFrom="md"
            size="sm"
            aria-label="Toggle navigation"
          />
          <img src={noesisLogo} alt="" width={28} height={28} />
          <Text fw={600} visibleFrom="sm">
            Noesis
          </Text>
          <Divider
            orientation="vertical"
            h={24}
            visibleFrom="sm"
            style={{ alignSelf: 'center' }}
          />
          <ChangePicker
            compact
            changes={changes}
            current={activeChange}
            onNavigate={navbarOpened ? onToggleNavbar : undefined}
          />
        </Group>
        <Group gap="xs" wrap="nowrap">
          <DevToolsButton />
          <ColorSchemeToggle />
        </Group>
      </Group>
      <Box h={48} visibleFrom="md" className={classes.bar}>
        <ChangeNav />
      </Box>
    </Stack>
  );
}

/** Dev tools, for internal use: an icon beside the colour scheme, while enabled. */
function DevToolsButton() {
  const { enabled } = useDevToolsContext();
  const [opened, dialog] = useDisclosure(false);
  if (!enabled) return null;
  return (
    <>
      {APP_PUBLIC_NAV.devTools.map((entry) => (
        <Tooltip key={entry.to} label={entry.label}>
          <ActionIcon
            variant="default"
            size="lg"
            aria-label={entry.label}
            onClick={dialog.open}
          >
            <entry.icon size={18} />
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

function ColorSchemeToggle() {
  const { colorScheme, setColorScheme } = useMantineColorScheme();
  const computed = useComputedColorScheme('light');
  const Current = computed === 'dark' ? IconMoon : IconSun;
  return (
    <Menu position="bottom-end" shadow="md" width={160}>
      <Menu.Target>
        <ActionIcon
          variant="default"
          size="lg"
          aria-label="Colour scheme"
          title="Colour scheme"
        >
          <Current size={18} />
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
