import { IconSelector } from '@tabler/icons-react';
import { useNavigate } from '@tanstack/react-router';
import { Badge } from '#/shared/design-system/badge';
import { Box } from '#/shared/design-system/box';
import { Group } from '#/shared/design-system/group';
import { Menu } from '#/shared/design-system/menu';
import { Text } from '#/shared/design-system/text';
import { UnstyledButton } from '#/shared/design-system/unstyled-button';
import type { Change } from '#backend/app/changes/change.ts';
import {
  CHANGE_STATUS_META,
  CHANGE_TYPE_META,
  changeSwatch,
} from '../changes.model.ts';
import classes from './change-picker.module.css';

interface ChangePickerProps {
  changes: Change[];
  current: Change | null;
  onNavigate?: () => void;
}

function detailLine(change: Change): string {
  return [
    change.key,
    CHANGE_TYPE_META[change.type].label,
    CHANGE_STATUS_META[change.status].label.toLowerCase(),
  ]
    .filter(Boolean)
    .join(' · ');
}

export function ChangePicker({
  changes,
  current,
  onNavigate,
}: ChangePickerProps) {
  const navigate = useNavigate();

  const choose = async (change: Change) => {
    onNavigate?.();
    await navigate({
      to: '/changes/$changeId',
      params: { changeId: change.id },
    });
  };

  return (
    <Box>
      <Menu width="target" position="bottom-start" shadow="md" offset={4}>
        <Menu.Target>
          <UnstyledButton className={classes.pick} aria-label="Switch change">
            <Group gap={10} wrap="nowrap" align="stretch">
              <Box
                className={classes.bar}
                mih={24}
                bg={
                  current
                    ? changeSwatch(current.id)
                    : 'var(--mantine-color-gray-4)'
                }
              />
              <Box style={{ flex: 1, minWidth: 0 }}>
                <Text size="sm" fw={600} truncate lh={1.3}>
                  {current ? current.name : 'No change yet'}
                </Text>
                {current ? (
                  <>
                    {current.key ? (
                      <Text size="xs" c="dimmed" ff="monospace" lh={1.4}>
                        {current.key}
                      </Text>
                    ) : null}
                    <Group gap={6} mt={4} wrap="nowrap">
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
                  </>
                ) : (
                  <Text size="xs" c="dimmed" truncate lh={1.3}>
                    Ask the agent to create one
                  </Text>
                )}
              </Box>
              <IconSelector
                size={16}
                style={{ flex: 'none', color: 'var(--mantine-color-dimmed)' }}
              />
            </Group>
          </UnstyledButton>
        </Menu.Target>
        <Menu.Dropdown>
          <Menu.Label>
            {changes.length > 0 ? 'Your changes' : 'No changes yet'}
          </Menu.Label>
          {changes.map((change) => (
            <Menu.Item
              key={change.id}
              className={classes.item}
              data-current={change.id === current?.id || undefined}
              leftSection={
                <Box
                  className={classes.bar}
                  h={22}
                  bg={changeSwatch(change.id)}
                />
              }
              onClick={() => choose(change)}
            >
              <Text size="sm" fw={500} truncate lh={1.3}>
                {change.name}
              </Text>
              <Text size="xs" className={classes.subLabel} truncate lh={1.3}>
                {detailLine(change)}
              </Text>
            </Menu.Item>
          ))}
        </Menu.Dropdown>
      </Menu>
    </Box>
  );
}
