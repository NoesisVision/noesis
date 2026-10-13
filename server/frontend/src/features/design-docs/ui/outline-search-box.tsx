import { IconSearch, IconWorld, IconX } from '@tabler/icons-react';
import type { OutlineScope } from '#/features/design-docs/ui/model-tree/outline-scope.ts';
import type { ModelTreeController } from '#/features/design-docs/ui/model-tree/use-model-tree.ts';
import { ActionIcon } from '#/shared/design-system/action-icon.tsx';
import { Group } from '#/shared/design-system/group.tsx';
import { Stack } from '#/shared/design-system/stack.tsx';
import { TextInput } from '#/shared/design-system/text-input.tsx';
import { Text } from '#/shared/design-system/text.tsx';
import { Tooltip } from '#/shared/design-system/tooltip.tsx';
import {
  IconChevronsDownUp,
  IconChevronsUpDown,
} from '#/shared/ui/icons/icons.ts';
import classes from './outline-search-box.module.css';

/**
 * Names and patterns, never descriptions: typing `service` reaches every
 * application service in the design without a filter control beside the box.
 */
export function OutlineSearchBox({
  controller,
  counts = 'elements',
  scope,
}: {
  controller: ModelTreeController;
  /** What the tree's rows are, in the plural, for the count of those found. */
  counts?: string;
  /** Whether the tree shows everything or only the public face; no switch without it. */
  scope?: { value: OutlineScope; onChange: (scope: OutlineScope) => void };
}) {
  const { query, ask, search, tree, expandAll, collapseAll } = controller;
  return (
    <Stack gap={4}>
      <Group gap="xs" wrap="nowrap" align="flex-start">
        <TextInput
          size="sm"
          className={classes.search}
          value={query}
          onChange={(event) => ask(event.currentTarget.value)}
          aria-label="Search the outline"
          placeholder="Search names and patterns"
          leftSection={<IconSearch size={16} stroke={1.6} aria-hidden />}
          rightSection={
            query === '' ? null : (
              <ActionIcon
                variant="subtle"
                size="sm"
                aria-label="Clear the search"
                onClick={() => ask('')}
              >
                <IconX size={14} stroke={1.6} aria-hidden />
              </ActionIcon>
            )
          }
        />
        {/* Two buttons and not one switch: half a tree is open as often as
            not, and a switch would have to guess which way that counts. */}
        <Tooltip label="Expand all" openDelay={300}>
          <ActionIcon
            variant="default"
            size="input-sm"
            aria-label="Expand everything"
            onClick={expandAll}
          >
            <IconChevronsUpDown size={18} stroke={1.6} aria-hidden />
          </ActionIcon>
        </Tooltip>
        <Tooltip label="Collapse all" openDelay={300}>
          <ActionIcon
            variant="default"
            size="input-sm"
            aria-label="Collapse everything"
            onClick={collapseAll}
          >
            <IconChevronsDownUp size={18} stroke={1.6} aria-hidden />
          </ActionIcon>
        </Tooltip>
        {scope !== undefined && (
          // One button that stays pressed: the tree shows the public face
          // while it is down, and everything again once it is let up.
          <Tooltip
            label={scope.value === 'public' ? 'Show all' : 'Public only'}
            openDelay={300}
          >
            <ActionIcon
              variant={scope.value === 'public' ? 'light' : 'default'}
              size="input-sm"
              aria-label="Only what is public"
              aria-pressed={scope.value === 'public'}
              onClick={() =>
                scope.onChange(scope.value === 'public' ? 'all' : 'public')
              }
            >
              <IconWorld size={18} stroke={1.6} aria-hidden />
            </ActionIcon>
          </Tooltip>
        )}
      </Group>
      {search.active && (
        <Text component="output" size="xs" c="dimmed">
          {`${search.matched.size} of ${tree.nodes.length} ${counts}`}
        </Text>
      )}
    </Stack>
  );
}
