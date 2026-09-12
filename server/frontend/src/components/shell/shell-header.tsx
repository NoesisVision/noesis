import {
  ActionIcon,
  Burger,
  Group,
  Text,
  ThemeIcon,
  Tooltip,
  useMantineColorScheme,
} from '@mantine/core';
import { IconDeviceDesktop, IconMoon, IconSun } from '@tabler/icons-react';

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

const SCHEMES = ['light', 'dark', 'auto'] as const;

function ColorSchemeToggle() {
  const { colorScheme, setColorScheme } = useMantineColorScheme();
  const next = SCHEMES[(SCHEMES.indexOf(colorScheme) + 1) % SCHEMES.length];
  const Icon =
    colorScheme === 'light'
      ? IconSun
      : colorScheme === 'dark'
        ? IconMoon
        : IconDeviceDesktop;
  return (
    <Tooltip label={`Colour scheme: ${colorScheme} (switch to ${next})`}>
      <ActionIcon
        variant="default"
        size="lg"
        aria-label={`Colour scheme: ${colorScheme}`}
        onClick={() => setColorScheme(next)}
      >
        <Icon size={18} />
      </ActionIcon>
    </Tooltip>
  );
}
