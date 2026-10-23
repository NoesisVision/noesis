import {
  IconLayoutSidebarLeftCollapse,
  IconSearch,
  IconWorld,
  IconX,
} from '@tabler/icons-react';
import type { OutlineScope } from '#/features/design-docs/ui/model-tree/outline-scope.ts';
import type { ModelTreeController } from '#/features/design-docs/ui/model-tree/use-model-tree.ts';
import { ActionIcon } from '#/shared/design-system/action-icon.tsx';
import { Group } from '#/shared/design-system/group.tsx';
import { Stack } from '#/shared/design-system/stack.tsx';
import { TextInput } from '#/shared/design-system/text-input.tsx';
import { Text } from '#/shared/design-system/text.tsx';
import { Tooltip } from '#/shared/design-system/tooltip.tsx';
import { UnstyledButton } from '#/shared/design-system/unstyled-button.tsx';
import {
  IconChevronsDownUp,
  IconChevronsUpDown,
} from '#/shared/ui/icons/icons.ts';
import { useTreeFold } from './tree-fold.tsx';
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
  const fold = useTreeFold();
  return (
    <Stack gap={10} className={classes.box}>
      <TextInput
        ref={fold?.searchRef}
        size="sm"
        classNames={{ input: classes.input }}
        value={query}
        onChange={(event) => ask(event.currentTarget.value)}
        aria-label="Search the outline"
        placeholder="Filter names and patterns"
        leftSection={<IconSearch size={16} stroke={1.6} aria-hidden />}
        rightSectionWidth={query === '' ? 64 : 92}
        rightSectionPointerEvents="all"
        rightSection={
          // Inside the field, after what is typed: clearing it, then the
          // two buttons that fold the tree. Two and not one switch: half a
          // tree is open as often as not, and a switch would have to guess
          // which way that counts.
          <Group gap={2} wrap="nowrap">
            {query !== '' && (
              <ActionIcon
                variant="subtle"
                color="gray"
                size={26}
                aria-label="Clear the search"
                onClick={() => ask('')}
              >
                <IconX size={14} stroke={1.6} aria-hidden />
              </ActionIcon>
            )}
            <Tooltip label="Expand all" openDelay={300}>
              <ActionIcon
                variant="subtle"
                color="gray"
                size={26}
                aria-label="Expand everything"
                onClick={expandAll}
              >
                <IconChevronsUpDown size={16} stroke={1.6} aria-hidden />
              </ActionIcon>
            </Tooltip>
            <Tooltip label="Collapse all" openDelay={300}>
              <ActionIcon
                variant="subtle"
                color="gray"
                size={26}
                aria-label="Collapse everything"
                onClick={collapseAll}
              >
                <IconChevronsDownUp size={16} stroke={1.6} aria-hidden />
              </ActionIcon>
            </Tooltip>
          </Group>
        }
      />
      {(scope !== undefined || fold !== null) && (
        <Group gap={6} wrap="nowrap" px={2}>
          {scope !== undefined && (
            // A chip that stays pressed: the tree shows the public face
            // while it is down, and everything again once it is let up.
            <Tooltip
              label={scope.value === 'public' ? 'Show all' : 'Public only'}
              openDelay={300}
            >
              <UnstyledButton
                className={classes.chip}
                aria-label="Only what is public"
                aria-pressed={scope.value === 'public'}
                onClick={() =>
                  scope.onChange(scope.value === 'public' ? 'all' : 'public')
                }
              >
                <IconWorld size={14} stroke={1.6} aria-hidden />
                Public
              </UnstyledButton>
            </Tooltip>
          )}
          {fold !== null && (
            // At the end of the line: the one that puts the tree away
            // altogether, to a rail at the pane's edge.
            <Tooltip label={`Hide tree ${fold.shortcut}`} openDelay={300}>
              <ActionIcon
                variant="subtle"
                color="gray"
                size={26}
                ml="auto"
                aria-label="Hide the tree"
                aria-keyshortcuts="Meta+Backslash Control+Backslash"
                onClick={fold.hide}
              >
                <IconLayoutSidebarLeftCollapse
                  size={16}
                  stroke={1.6}
                  aria-hidden
                />
              </ActionIcon>
            </Tooltip>
          )}
        </Group>
      )}
      {search.active && (
        <Text component="output" size="xs" c="dimmed">
          {`${search.matched.size} of ${tree.nodes.length} ${counts}`}
        </Text>
      )}
    </Stack>
  );
}
