import { IconSearch, IconX } from '@tabler/icons-react';
import { ActionIcon } from '#/shared/design-system/action-icon.tsx';
import { Group } from '#/shared/design-system/group.tsx';
import { Stack } from '#/shared/design-system/stack.tsx';
import { TextInput } from '#/shared/design-system/text-input.tsx';
import { Text } from '#/shared/design-system/text.tsx';
import {
  IconChevronsDownUp,
  IconChevronsUpDown,
} from '#/shared/ui/icons/icons.ts';
import type { ModelTreeController } from '#/shared/ui/model-tree/use-model-tree.ts';
import classes from './outline-search-box.module.css';

/**
 * Names and patterns, never descriptions: typing `service` reaches every
 * application service in the design without a filter control beside the box.
 */
export function OutlineSearchBox({
  controller,
}: {
  controller: ModelTreeController;
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
        <ActionIcon
          variant="default"
          size="input-sm"
          aria-label="Expand everything"
          title="Expand everything"
          onClick={expandAll}
        >
          <IconChevronsUpDown size={18} stroke={1.6} aria-hidden />
        </ActionIcon>
        <ActionIcon
          variant="default"
          size="input-sm"
          aria-label="Collapse everything"
          title="Collapse everything"
          onClick={collapseAll}
        >
          <IconChevronsDownUp size={18} stroke={1.6} aria-hidden />
        </ActionIcon>
      </Group>
      {search.active && (
        <Text component="output" size="xs" c="dimmed">
          {`${search.matched.size} of ${tree.nodes.length} elements`}
        </Text>
      )}
    </Stack>
  );
}
