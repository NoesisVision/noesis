import { Blockquote, Stack, Text } from '@noesis/design-system';

export const Statement = () => (
  <Stack gap="md" w={560}>
    <Blockquote color="brand" radius="sm" py="xs" px="sm">
      The quality managers need to start a QDoc in the QDoc System when the
      organisation decides the QDoc is needed, naming the authors who will
      write the QDoc.
    </Blockquote>
    <Text fz="sm" c="dimmed">
      Stakeholder: Quality managers
    </Text>
  </Stack>
);
