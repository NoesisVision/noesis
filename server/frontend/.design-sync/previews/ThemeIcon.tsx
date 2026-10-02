import {
  Box,
  Group,
  IconAi,
  IconFileText,
  IconGitPullRequest,
  IconRadar,
  IconUser,
  Text,
  ThemeIcon,
  Title,
} from '@noesis/design-system';

export const Variants = () => (
  <Group gap="sm">
    {(['filled', 'light', 'outline', 'default', 'transparent', 'white'] as const).map((variant) => (
      <ThemeIcon key={variant} variant={variant} size="lg">
        <IconFileText size={20} stroke={1.6} />
      </ThemeIcon>
    ))}
  </Group>
);

export const Sizes = () => (
  <Group gap="sm" align="center">
    {(['xs', 'sm', 'md', 'lg', 'xl'] as const).map((size) => (
      <ThemeIcon key={size} variant="light" size={size} radius="md">
        <IconRadar size="70%" stroke={1.6} />
      </ThemeIcon>
    ))}
  </Group>
);

export const PageHeading = () => (
  <Group gap="sm" wrap="nowrap">
    <ThemeIcon variant="light" size="lg" radius="md" aria-hidden>
      <IconGitPullRequest size={22} stroke={1.6} />
    </ThemeIcon>
    <Box>
      <Title order={1} size="h2" mb={0}>
        Changes
      </Title>
      <Text size="sm" c="dimmed">
        Proposed edits to the architecture, grouped by change.
      </Text>
    </Box>
  </Group>
);

export const Authorship = () => (
  <Group gap="lg">
    <Group gap={6}>
      <Text size="sm" fw={600}>
        Description
      </Text>
      <ThemeIcon size="xs" variant="default" aria-hidden="true">
        <IconUser size={14} stroke={2} />
      </ThemeIcon>
    </Group>
    <Group gap={6}>
      <Text size="sm" fw={600}>
        Input / output
      </Text>
      <ThemeIcon size="xs" variant="default" aria-hidden="true">
        <IconAi size={18} stroke={2} />
      </ThemeIcon>
    </Group>
  </Group>
);

export const Colors = () => (
  <Group gap="sm">
    {(['brand', 'teal', 'orange', 'red', 'gray'] as const).map((color) => (
      <ThemeIcon key={color} color={color} variant="light" size="lg" radius="md">
        <IconRadar size={20} stroke={1.6} />
      </ThemeIcon>
    ))}
  </Group>
);
