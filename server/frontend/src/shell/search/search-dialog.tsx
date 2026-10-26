import { IconSearch } from '@tabler/icons-react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';
import { type KeyboardEvent, useId, useMemo, useState } from 'react';
import { currentProject } from '#/features/project/project.api.ts';
import { Box } from '#/shared/design-system/box';
import { Divider } from '#/shared/design-system/divider';
import { Group } from '#/shared/design-system/group';
import { Kbd } from '#/shared/design-system/kbd';
import { Modal } from '#/shared/design-system/modal';
import { Text } from '#/shared/design-system/text';
import { TextInput } from '#/shared/design-system/text-input';
import { useChangeNav } from '#/shell/navigation/use-change-nav.ts';
import {
  matchingGroups,
  type SearchEntry,
  searchGroups,
} from './search-entries.ts';
import classes from './search-dialog.module.css';

interface SearchDialogProps {
  opened: boolean;
  onClose: () => void;
}

/**
 * Search over the app, centred above the page: what is in the change you are
 * in, the app's own places and the other changes, narrowed as you type. The
 * arrows move through what is listed and Enter opens it.
 */
export function SearchDialog({ opened, onClose }: SearchDialogProps) {
  const titleId = useId();
  return (
    <Modal
      opened={opened}
      onClose={onClose}
      size={640}
      radius={14}
      padding={0}
      yOffset={96}
      withCloseButton={false}
      title={<span id={titleId}>Search Noesis</span>}
      overlayProps={{ backgroundOpacity: 0.32, blur: 4 }}
      classNames={{ header: classes.header, content: classes.content }}
    >
      {/* Mounted only while open, so each search starts empty. */}
      <SearchPanel onClose={onClose} />
    </Modal>
  );
}

function SearchPanel({ onClose }: { onClose: () => void }) {
  const navigate = useNavigate();
  const { changes, activeChange } = useChangeNav();
  const { data: project } = useQuery(currentProject);
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState(0);
  const listId = useId();

  const groups = useMemo(
    () =>
      matchingGroups(
        searchGroups({ changes, activeChange, projectName: project?.name }),
        query,
      ),
    [changes, activeChange, project?.name, query],
  );
  const entries = groups.flatMap((group) => group.entries);
  const current = Math.min(selected, Math.max(entries.length - 1, 0));
  const optionId = (index: number) => `${listId}-${index}`;

  const open = (entry: SearchEntry) => {
    onClose();
    void navigate({ ...entry.link, viewTransition: true });
  };

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setSelected(Math.min(current + 1, entries.length - 1));
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setSelected(Math.max(current - 1, 0));
    } else if (event.key === 'Enter') {
      const entry = entries[current];
      if (entry) {
        event.preventDefault();
        open(entry);
      }
    }
  };

  let index = 0;
  return (
    <>
      <Group gap="xs" wrap="nowrap" px="md" py={8}>
        <TextInput
          data-autofocus
          flex={1}
          variant="unstyled"
          size="lg"
          placeholder="Search Noesis"
          aria-label="Search Noesis"
          // An input that steers a list it does not open: no tag says that.
          // oxlint-disable-next-line jsx-a11y/prefer-tag-over-role
          role="combobox"
          aria-expanded
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={
            entries.length > 0 ? optionId(current) : undefined
          }
          value={query}
          onChange={(event) => {
            setQuery(event.currentTarget.value);
            setSelected(0);
          }}
          onKeyDown={onKeyDown}
          leftSection={<IconSearch size={22} stroke={1.6} aria-hidden />}
          leftSectionWidth={40}
        />
        <Kbd size="xs">esc</Kbd>
      </Group>
      <Divider />
      {/* A list of links to pick with the arrows, which no tag is. */}
      <Box
        id={listId}
        // oxlint-disable-next-line jsx-a11y/prefer-tag-over-role
        role="listbox"
        aria-label="Results"
        className={classes.results}
      >
        {groups.map((group) => {
          const labelId = `${listId}-${group.label}`;
          return (
            <Box
              key={group.label}
              // oxlint-disable-next-line jsx-a11y/prefer-tag-over-role
              role="group"
              aria-labelledby={labelId}
            >
              <Text
                id={labelId}
                size="xs"
                fw={600}
                c="dimmed"
                className={classes.groupLabel}
              >
                {group.label}
              </Text>
              {group.entries.map((entry) => {
                const at = index++;
                const isSelected = at === current;
                return (
                  // The input keeps the focus and says which option is
                  // active; a click still opens the one under the pointer.
                  <Box
                    key={entry.id}
                    id={optionId(at)}
                    // oxlint-disable-next-line jsx-a11y/prefer-tag-over-role
                    role="option"
                    aria-selected={isSelected}
                    className={classes.option}
                    onMouseDown={(event) => event.preventDefault()}
                    onMouseEnter={() => setSelected(at)}
                    onClick={() => open(entry)}
                  >
                    <Box className={classes.tile} aria-hidden>
                      <entry.icon size={18} stroke={1.6} />
                    </Box>
                    <Box flex={1} miw={0}>
                      <Text size="sm" fw={500} truncate>
                        {entry.label}
                      </Text>
                      <Text size="xs" c="dimmed" truncate>
                        {entry.context}
                      </Text>
                    </Box>
                    {isSelected && (
                      <Text size="xs" c="dimmed" aria-hidden>
                        ↵ Open
                      </Text>
                    )}
                  </Box>
                );
              })}
            </Box>
          );
        })}
        {entries.length === 0 && (
          <Text size="sm" c="dimmed" ta="center" py={32}>
            No results for “{query}”
          </Text>
        )}
      </Box>
      <Group gap="md" px="md" py={8} className={classes.footer} aria-hidden>
        <Text size="xs" c="dimmed">
          ↑↓ Navigate
        </Text>
        <Text size="xs" c="dimmed">
          ↵ Open
        </Text>
        <Text size="xs" c="dimmed">
          esc Close
        </Text>
      </Group>
    </>
  );
}
