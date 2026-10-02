import { ActionIcon, Group, IconAi, IconMaximize, Text, ThemeIcon, Tooltip } from '@noesis/design-system';

export const ElementRef = () => (
  <Group p="md">
    <Tooltip opened withinPortal={false} label="ReserveStockOnOrderPlaced" position="right">
      <Text size="sm" c="brand" fw={500} truncate w={90}>
        ReserveStockOnOrderPlaced
      </Text>
    </Tooltip>
  </Group>
);

export const Authorship = () => (
  <Group p="md" pt={48}>
    <Text size="sm" fw={600}>
      Input / output
    </Text>
    <ThemeIcon size="xs" variant="default" aria-hidden="true">
      <Tooltip opened withinPortal={false} label="Written by the scanner">
        <IconAi size={18} stroke={2} />
      </Tooltip>
    </ThemeIcon>
  </Group>
);

export const OnActionIcon = () => (
  <Group p="md" pb={48}>
    <Tooltip opened withinPortal={false} label="Read in full screen" position="bottom">
      <ActionIcon variant="default" size="lg" aria-label="Read in full screen">
        <IconMaximize size={18} stroke={1.6} />
      </ActionIcon>
    </Tooltip>
  </Group>
);
