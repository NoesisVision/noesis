import { IconCheck, IconSelector } from '@tabler/icons-react';
import { useNavigate } from '@tanstack/react-router';
import { Box } from '#/shared/design-system/box';
import { Group } from '#/shared/design-system/group';
import { Menu } from '#/shared/design-system/menu';
import { Stack } from '#/shared/design-system/stack';
import { Text } from '#/shared/design-system/text';
import { ThemeIcon } from '#/shared/design-system/theme-icon';
import { UnstyledButton } from '#/shared/design-system/unstyled-button';
import { titleCase } from '#/shared/ui/title-case.ts';
import type { ChangeWithEntries } from '#backend/app/changes/change-entry.ts';
import {
  CHANGE_STAGES,
  CHANGE_STATUS_META,
  CHANGE_TYPE_META,
  changeAge,
  changeInitials,
  changeKindLine,
  changeSwatchColor,
} from '../changes.model.ts';
import classes from './change-picker.module.css';

type Change = ChangeWithEntries;

interface ChangePickerProps {
  changes: Change[];
  current: Change | null;
  onNavigate?: () => void;
  /** Only the change's tile, for the rail folded to icons. */
  compact?: boolean;
}

/** A change's tile: its initials on its own colour. */
function ChangeTile({ change, size }: { change: Change | null; size: number }) {
  return (
    <ThemeIcon
      size={size}
      radius={Math.round(size * 0.3)}
      variant="light"
      color={change ? changeSwatchColor(change.id) : 'gray'}
      className={classes.tile}
      aria-hidden
    >
      {change ? changeInitials(change.name) : '–'}
    </ThemeIcon>
  );
}

/** What the card says under the name: what kind of change, at which stage. */
function stageLine(change: Change): string {
  return `${titleCase(CHANGE_TYPE_META[change.type].label)} · ${CHANGE_STATUS_META[change.status].label} stage`;
}

/**
 * The head of the rail's change card: the change you are in, by its tile, its
 * name and its stage, with its progress through the stages under it. The
 * whole head is the button that switches to another change.
 */
export function ChangePicker({
  changes,
  current,
  onNavigate,
  compact = false,
}: ChangePickerProps) {
  const navigate = useNavigate();

  const choose = async (change: Change) => {
    onNavigate?.();
    await navigate({
      to: '/changes/$changeId',
      params: { changeId: change.id },
    });
  };

  const stage = current ? CHANGE_STAGES.indexOf(current.status) : -1;
  const stageColor = current
    ? CHANGE_STATUS_META[current.status].color
    : 'gray';

  const tile = <ChangeTile change={current} size={36} />;
  // The others, newest first: a change's id starts with the day it was made.
  // Every change, newest first: a change's id starts with the day it was made.
  const all = changes.toSorted((a, b) => b.id.localeCompare(a.id));
  const now = new Date();

  return (
    <Box miw={0}>
      <Menu width={380} position="right-start" shadow="md" offset={12}>
        <Menu.Target>
          {compact ? (
            <UnstyledButton
              className={classes.tileButton}
              aria-label={
                current
                  ? `Switch change (now ${current.name})`
                  : 'Switch change'
              }
              title={current?.name}
            >
              {tile}
            </UnstyledButton>
          ) : (
            <UnstyledButton className={classes.card} aria-label="Switch change">
              <Stack gap={12}>
                <Group gap={10} wrap="nowrap" align="flex-start">
                  {tile}
                  <Box style={{ flex: 1, minWidth: 0 }}>
                    <Text size="sm" fw={600} lh={1.35} lineClamp={2}>
                      {current ? current.name : 'No change yet'}
                    </Text>
                    <Text size="xs" className={classes.subLabel} truncate>
                      {current
                        ? stageLine(current)
                        : 'Ask the agent to create one'}
                    </Text>
                  </Box>
                  <IconSelector
                    size={16}
                    aria-hidden
                    style={{
                      flex: 'none',
                      // Level with the tile's middle, however long the name.
                      marginTop: 10,
                      color: 'var(--mantine-color-dimmed)',
                    }}
                  />
                </Group>
                <Box className={classes.stages} aria-hidden>
                  {CHANGE_STAGES.map((status, i) => (
                    <Box
                      key={status}
                      className={classes.stage}
                      data-reached={i <= stage || undefined}
                      style={{
                        '--stage-color': `var(--mantine-color-${stageColor}-5)`,
                      }}
                    />
                  ))}
                </Box>
              </Stack>
            </UnstyledButton>
          )}
        </Menu.Target>
        <Menu.Dropdown>
          {all.length === 0 && <Menu.Label>No changes yet</Menu.Label>}
          {all.map((change) => {
            const isCurrent = change.id === current?.id;
            return (
              <Menu.Item
                key={change.id}
                className={classes.item}
                classNames={{ itemLabel: classes.itemLabel }}
                aria-current={isCurrent || undefined}
                leftSection={<ChangeTile change={change} size={36} />}
                rightSection={
                  isCurrent ? (
                    <IconCheck
                      size={18}
                      stroke={2}
                      className={classes.check}
                      aria-label="Current"
                    />
                  ) : (
                    <Text size="xs" className={classes.age}>
                      {changeAge(change.id, now)}
                    </Text>
                  )
                }
                onClick={() => choose(change)}
              >
                <Text size="sm" fw={500} lh={1.3} className={classes.name}>
                  {change.name}
                </Text>
                <Text size="xs" className={classes.subLabel} truncate lh={1.4}>
                  {changeKindLine(change)}
                </Text>
              </Menu.Item>
            );
          })}
        </Menu.Dropdown>
      </Menu>
    </Box>
  );
}
