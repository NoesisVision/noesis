import { Stack, TagsInput } from '@noesis/design-system';

export const Actors = () => (
  <Stack gap="md" w={360}>
    <TagsInput
      label="Actors"
      description="Who may call it. Press Enter after each."
      defaultValue={['Guest', 'Front desk']}
    />
    <TagsInput label="Actors" placeholder="Add an actor" />
  </Stack>
);
