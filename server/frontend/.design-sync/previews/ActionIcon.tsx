import {
  ActionIcon,
  Group,
  IconChevronsDownUp,
  IconChevronsUpDown,
  IconPencil,
  IconPlus,
  IconSun,
  IconTrash,
  IconX,
} from '@noesis/design-system';

export const Variants = () => (
  <Group gap="sm">
    <ActionIcon aria-label="New change">
      <IconPlus size={18} />
    </ActionIcon>
    <ActionIcon variant="light" aria-label="Edit document">
      <IconPencil size={18} />
    </ActionIcon>
    <ActionIcon variant="outline" aria-label="Edit document">
      <IconPencil size={18} />
    </ActionIcon>
    <ActionIcon variant="default" aria-label="Colour scheme">
      <IconSun size={18} />
    </ActionIcon>
    <ActionIcon variant="subtle" aria-label="Clear the search">
      <IconX size={18} />
    </ActionIcon>
    <ActionIcon variant="light" color="red" aria-label="Delete scanner">
      <IconTrash size={18} />
    </ActionIcon>
  </Group>
);

export const Sizes = () => (
  <Group gap="sm" align="center">
    {(['xs', 'sm', 'md', 'lg', 'xl'] as const).map((size) => (
      <ActionIcon key={size} size={size} variant="light" aria-label="New element">
        <IconPlus size={size === 'xs' ? 12 : size === 'sm' ? 14 : 18} />
      </ActionIcon>
    ))}
  </Group>
);

export const OutlineToolbar = () => (
  <Group gap="xs">
    <ActionIcon
      variant="default"
      size="input-sm"
      aria-label="Expand everything"
      title="Expand everything"
    >
      <IconChevronsUpDown size={18} stroke={1.6} />
    </ActionIcon>
    <ActionIcon
      variant="default"
      size="input-sm"
      aria-label="Collapse everything"
      title="Collapse everything"
    >
      <IconChevronsDownUp size={18} stroke={1.6} />
    </ActionIcon>
  </Group>
);

export const States = () => (
  <Group gap="sm">
    <ActionIcon variant="filled" loading aria-label="Scanning repository">
      <IconPlus size={18} />
    </ActionIcon>
    <ActionIcon variant="filled" disabled aria-label="New change">
      <IconPlus size={18} />
    </ActionIcon>
    <ActionIcon variant="default" disabled aria-label="Edit document">
      <IconPencil size={18} />
    </ActionIcon>
  </Group>
);
