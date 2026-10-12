import { Radio, Stack } from '@noesis/design-system';

export const RemovalChoice = () => (
  <Radio.Group defaultValue="removeFromSystem" label="What should this design do with Refund?">
    <Stack gap="sm" mt="xs">
      <Radio
        value="discard"
        label="Discard this design's changes to it"
        description="The model keeps Refund as it is."
      />
      <Radio
        value="removeFromSystem"
        label="Remove it from the system"
        description="The design deletes Refund, and what is under it goes with it."
      />
    </Stack>
  </Radio.Group>
);

export const States = () => (
  <Stack gap="xs">
    <Radio label="Checked" defaultChecked />
    <Radio label="Unchecked" />
    <Radio label="Disabled" disabled />
  </Stack>
);
