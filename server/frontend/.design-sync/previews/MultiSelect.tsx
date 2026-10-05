import { MultiSelect, Stack } from '@noesis/design-system';

const NEEDS = [
  { value: 'start-a-qdoc', label: 'Start a QDoc' },
  { value: 'know-about-new-qdocs', label: 'Know about new QDocs' },
  { value: 'ready-to-write', label: 'Ready to write' },
];

export const RuleNeeds = () => (
  <Stack gap="md" w={360}>
    <MultiSelect
      label="Answers the needs"
      data={NEEDS}
      defaultValue={['start-a-qdoc', 'ready-to-write']}
    />
    <MultiSelect
      label="Answers the needs"
      data={NEEDS}
      placeholder="None: a decision of the design's own"
    />
  </Stack>
);

export const Opened = () => (
  <MultiSelect
    w={360}
    label="Answers the needs"
    data={NEEDS}
    defaultValue={['start-a-qdoc']}
    defaultDropdownOpened
    comboboxProps={{ withinPortal: false }}
  />
);
