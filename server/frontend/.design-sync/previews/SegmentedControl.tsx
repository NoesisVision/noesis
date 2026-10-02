import {
  Center,
  IconViewportNarrow,
  IconViewportWide,
  SegmentedControl,
  Stack,
  VisuallyHidden,
} from '@noesis/design-system';

export const ContentWidth = () => (
  <SegmentedControl
    aria-label="Content width"
    size="md"
    defaultValue="convenient"
    data={[
      {
        value: 'convenient',
        label: (
          <Center>
            <IconViewportNarrow size={22} stroke={1.6} aria-hidden />
            <VisuallyHidden>Convenient</VisuallyHidden>
          </Center>
        ),
      },
      {
        value: 'full',
        label: (
          <Center>
            <IconViewportWide size={22} stroke={1.6} aria-hidden />
            <VisuallyHidden>Full width</VisuallyHidden>
          </Center>
        ),
      },
    ]}
  />
);

export const TextLabels = () => (
  <SegmentedControl
    defaultValue="behaviours"
    data={[
      { value: 'elements', label: 'Elements' },
      { value: 'behaviours', label: 'Behaviours' },
      { value: 'scenarios', label: 'Scenarios' },
    ]}
  />
);

export const Colored = () => (
  <SegmentedControl
    color="brand"
    defaultValue="draft"
    data={[
      { value: 'draft', label: 'Draft' },
      { value: 'review', label: 'In review' },
      { value: 'approved', label: 'Approved' },
    ]}
  />
);

export const Sizes = () => (
  <Stack gap="sm" align="flex-start">
    <SegmentedControl size="xs" defaultValue="all" data={['All', 'Changed', 'New']} />
    <SegmentedControl size="sm" defaultValue="all" data={['All', 'Changed', 'New']} />
    <SegmentedControl size="lg" defaultValue="all" data={['All', 'Changed', 'New']} />
  </Stack>
);

export const States = () => (
  <Stack gap="sm" align="flex-start">
    <SegmentedControl
      fullWidth
      w={320}
      defaultValue="input"
      data={[
        { value: 'input', label: 'Input' },
        { value: 'output', label: 'Output' },
      ]}
    />
    <SegmentedControl
      disabled
      defaultValue="input"
      data={[
        { value: 'input', label: 'Input' },
        { value: 'output', label: 'Output' },
      ]}
    />
  </Stack>
);
