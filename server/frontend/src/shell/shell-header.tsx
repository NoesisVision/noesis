import {
  IconCheck,
  IconDeviceDesktop,
  IconMoon,
  IconSun,
} from '@tabler/icons-react';
import { ActionIcon } from '#/shared/design-system/action-icon';
import { Burger } from '#/shared/design-system/burger';
import {
  type MantineColorScheme,
  useComputedColorScheme,
  useMantineColorScheme,
} from '#/shared/design-system/color-scheme';
import { Group } from '#/shared/design-system/group';
import { Menu } from '#/shared/design-system/menu';
import { Text } from '#/shared/design-system/text';
import { ThemeIcon } from '#/shared/design-system/theme-icon';

interface ShellHeaderProps {
  navbarOpened: boolean;
  onToggleNavbar: () => void;
}

export function ShellHeader({
  navbarOpened,
  onToggleNavbar,
}: ShellHeaderProps) {
  return (
    <Group h="100%" px="md" justify="space-between">
      <Group gap="sm">
        <Burger
          opened={navbarOpened}
          onClick={onToggleNavbar}
          hiddenFrom="md"
          size="sm"
          aria-label="Toggle navigation"
        />
        <ThemeIcon radius="sm" size="md" variant="filled">
          <Text fw={700} size="sm" c="white">
            N
          </Text>
        </ThemeIcon>
        <Text fw={600}>Noesis</Text>
      </Group>
      <ColorSchemeToggle />
    </Group>
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
