import {
  ActionIcon,
  Group,
  IconAi,
  IconMaximize,
  IconUser,
  SegmentedControl,
  IconViewportNarrow,
  IconViewportWide,
  Stack,
  Text,
  ThemeIcon,
  VisuallyHidden,
} from '@noesis/design-system';

export const IconOnlyButton = () => (
  <Stack gap="xs" maw={320}>
    <ActionIcon variant="default" size="lg">
      <IconMaximize size={18} stroke={1.6} aria-hidden />
      <VisuallyHidden>Read in full screen</VisuallyHidden>
    </ActionIcon>
    <Text size="xs" c="dimmed">
      Screen readers announce “Read in full screen”; sighted users see only the icon.
    </Text>
  </Stack>
);

export const AuthorshipLabel = () => (
  <Stack gap="xs" maw={320}>
    <Group gap={6}>
      <Text size="sm" fw={600}>
        Description
      </Text>
      <ThemeIcon size="xs" variant="default" aria-hidden="true">
        <IconUser size={14} stroke={2} />
      </ThemeIcon>
      <VisuallyHidden>Written by a person</VisuallyHidden>
      <Text size="sm" fw={600} ml="md">
        Steps
      </Text>
      <ThemeIcon size="xs" variant="default" aria-hidden="true">
        <IconAi size={18} stroke={2} />
      </ThemeIcon>
      <VisuallyHidden>Written by the scanner</VisuallyHidden>
    </Group>
    <Text size="xs" c="dimmed">
      The author icons are decorative; the hidden text names who wrote each field.
    </Text>
  </Stack>
);

export const SegmentLabels = () => (
  <Stack gap="xs" maw={320}>
    <SegmentedControl
      data={[
        {
          value: 'convenient',
          label: (
            <>
              <IconViewportNarrow size={16} stroke={1.6} aria-hidden />
              <VisuallyHidden>Convenient</VisuallyHidden>
            </>
          ),
        },
        {
          value: 'full',
          label: (
            <>
              <IconViewportWide size={16} stroke={1.6} aria-hidden />
              <VisuallyHidden>Full width</VisuallyHidden>
            </>
          ),
        },
      ]}
    />
    <Text size="xs" c="dimmed">
      Reading width switch: each segment carries a hidden “Convenient” / “Full width” label.
    </Text>
  </Stack>
);
