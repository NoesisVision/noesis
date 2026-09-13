import { Button, Center, Stack, Text, Title } from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { IconPlus } from '@tabler/icons-react';
import { NewChangeModal } from '#/components/shell/new-change-modal';

/** The first-run experience: a checkout with no changes in `.noesis/graph/` yet. */
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
