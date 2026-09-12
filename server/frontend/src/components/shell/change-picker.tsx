import {
  Badge,
  Box,
  ColorSwatch,
  Group,
  Menu,
  Text,
  UnstyledButton,
} from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import type { Change } from '@repo/shared-contracts';
import { IconCheck, IconPlus, IconSelector } from '@tabler/icons-react';
import { useNavigate } from '@tanstack/react-router';
import {
  CHANGE_STATUS_META,
  CHANGE_TYPE_META,
  changeSwatch,
} from './change-status';
import { NewChangeModal } from './new-change-modal';

interface ChangePickerProps {
  changes: Change[];
  current: Change | null;
  onNavigate?: () => void;
}

/** The sidebar's head: the current change, a menu of all of them, and the way to a new one. */
export function ChangePicker({
  changes,
  current,
  onNavigate,
}: ChangePickerProps) {
  const navigate = useNavigate();
  const [modalOpened, modal] = useDisclosure(false);

  const choose = async (change: Change) => {
    onNavigate?.();
    await navigate({
      to: '/changes/$changeId',
      params: { changeId: change.slug },
    });
  };

  return (
    <>
      <Menu width="target" position="bottom-start" shadow="md">
        <Menu.Target>
          <UnstyledButton
            w="100%"
            p="sm"
            aria-label="Switch change"
            style={{
              border: '1px solid var(--mantine-color-default-border)',
              borderRadius: 'var(--mantine-radius-sm)',
            }}
          >
            <Group gap="sm" wrap="nowrap">
              {current ? (
                <ColorSwatch size={14} color={changeSwatch(current.slug)} />
              ) : (
                <ColorSwatch size={14} color="var(--mantine-color-gray-4)" />
              )}
              <Box style={{ flex: 1, minWidth: 0 }}>
                <Text size="xs" c="dimmed" lh={1.2}>
                  Change
                </Text>
                <Text size="sm" fw={600} truncate lh={1.3}>
                  {current ? current.name : 'No change yet'}
                </Text>
                {current ? (
                  <Group gap={6} mt={4} wrap="nowrap">
                    {current.key ? (
                      <Text size="xs" c="dimmed" ff="monospace">
                        {current.key}
                      </Text>
                    ) : null}
                    <Badge
                      size="xs"
                      variant="outline"
                      color={CHANGE_TYPE_META[current.type].color}
                    >
                      {CHANGE_TYPE_META[current.type].label}
                    </Badge>
                    <Badge
                      size="xs"
                      variant="light"
                      color={CHANGE_STATUS_META[current.status].color}
                    >
                      {CHANGE_STATUS_META[current.status].label}
                    </Badge>
                  </Group>
                ) : null}
              </Box>
              <IconSelector size={16} style={{ opacity: 0.6 }} />
            </Group>
          </UnstyledButton>
        </Menu.Target>
        <Menu.Dropdown>
          {changes.length > 0 ? (
            <Menu.Label>Changes</Menu.Label>
          ) : (
            <Menu.Label>No changes yet</Menu.Label>
          )}
          {changes.map((change) => (
            <Menu.Item
              key={change.slug}
              leftSection={
                <ColorSwatch size={12} color={changeSwatch(change.slug)} />
              }
              rightSection={
                change.slug === current?.slug ? <IconCheck size={14} /> : null
              }
              onClick={() => choose(change)}
            >
              <Group gap="xs" wrap="nowrap">
                <Text size="sm" truncate>
                  {change.name}
                </Text>
                {change.key ? (
                  <Text size="xs" c="dimmed" ff="monospace">
                    {change.key}
                  </Text>
                ) : null}
              </Group>
            </Menu.Item>
          ))}
          <Menu.Divider />
          <Menu.Item leftSection={<IconPlus size={14} />} onClick={modal.open}>
            New change
          </Menu.Item>
        </Menu.Dropdown>
      </Menu>
      <NewChangeModal opened={modalOpened} onClose={modal.close} />
    </>
  );
}
