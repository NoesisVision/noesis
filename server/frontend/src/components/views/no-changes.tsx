import { IconPlus } from '@tabler/icons-react';
import { Button } from '#/components/design-system/button';
import { Center } from '#/components/design-system/center';
import { useDisclosure } from '#/components/design-system/hooks';
import { Stack } from '#/components/design-system/stack';
import { Text } from '#/components/design-system/text';
import { Title } from '#/components/design-system/title';
import { NewChangeModal } from '#/components/shell/new-change-modal';

/** The first-run experience: a checkout with no `.noesis/changes/` yet. */
export function NoChangesView() {
  const [opened, modal] = useDisclosure(false);
  return (
    <Center mih="60vh">
      <Stack align="center" gap="sm" maw={420} ta="center">
        <Title order={2}>No changes yet</Title>
        <Text c="dimmed">
          A change is the unit of work Noesis tracks: imports, conversations and
          design documents all hang under one. Create the first to get started.
        </Text>
        <Button leftSection={<IconPlus size={16} />} onClick={modal.open}>
          Create your first change
        </Button>
        <NewChangeModal opened={opened} onClose={modal.close} />
      </Stack>
    </Center>
  );
}
