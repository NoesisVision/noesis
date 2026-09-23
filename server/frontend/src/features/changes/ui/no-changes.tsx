import { Center } from '#/shared/design-system/center';
import { Stack } from '#/shared/design-system/stack';
import { Text } from '#/shared/design-system/text';
import { Title } from '#/shared/design-system/title';

export function NoChangesView() {
  return (
    <Center mih="60vh">
      <Stack align="center" gap="sm" maw={420} ta="center">
        <Title order={1} size="h2">
          No changes yet
        </Title>
        <Text c="dimmed">
          A change is the unit of work Noesis tracks: imported documents and
          design documents all hang under one. Ask the agent to create the first
          one; this page only reads.
        </Text>
      </Stack>
    </Center>
  );
}
