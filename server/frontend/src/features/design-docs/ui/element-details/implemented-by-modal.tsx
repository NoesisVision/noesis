import { IconSearch, IconTopologyStar3, IconX } from '@tabler/icons-react';
import { useState } from 'react';
import { ActionIcon } from '#/shared/design-system/action-icon.tsx';
import { useDisclosure } from '#/shared/design-system/hooks.ts';
import { Modal } from '#/shared/design-system/modal.tsx';
import { Stack } from '#/shared/design-system/stack.tsx';
import { TextInput } from '#/shared/design-system/text-input.tsx';
import { Text } from '#/shared/design-system/text.tsx';
import { Tooltip } from '#/shared/design-system/tooltip.tsx';
import { UnstyledButton } from '#/shared/design-system/unstyled-button.tsx';
import { QualifiedName, shortName } from '#/shared/ui/qualified-name.tsx';
import { ChangeBadge } from './change-badge.tsx';
import type { ChangeListItem } from './change-list-items.ts';
import { useElementNavigation } from './element-navigation.ts';
import { ElementTooltip } from './element-tooltip.tsx';
import classes from './implemented-by-modal.module.css';

/**
 * The blocks that implement a type, behind one icon beside its badges: a
 * modal of `ImplementedByList`. Closing it drops what was typed in its box.
 */
export function ImplementedByModal({ items }: { items: ChangeListItem[] }) {
  const [opened, { open, close }] = useDisclosure(false);
  if (items.length === 0) return null;
  // What the icon is, on hover and to a screen reader alike.
  const label = `Implemented by ${items.length} ${items.length === 1 ? 'element' : 'elements'}`;
  return (
    <>
      <Tooltip label={label} openDelay={300} color="dark">
        <ActionIcon
          variant="subtle"
          size="sm"
          aria-label={label}
          onClick={open}
        >
          <IconTopologyStar3 size={16} aria-hidden="true" />
        </ActionIcon>
      </Tooltip>
      <Modal opened={opened} onClose={close} title="Implemented by" centered>
        <ImplementedByList items={items} onOpen={close} />
      </Modal>
    </>
  );
}

/**
 * Each implementer by its last segment, its address on hover, opening its
 * row when the tree has one. A box over the list narrows it by name or
 * address. One the design stops implementing the type is struck through,
 * and says so in its badge.
 */
export function ImplementedByList({
  items,
  onOpen,
}: {
  items: ChangeListItem[];
  /** Called as a row opens, before the panel moves to it. */
  onOpen: () => void;
}) {
  const [query, setQuery] = useState('');
  const { has, select } = useElementNavigation();
  const sorted = [...items].sort((a, b) =>
    shortName(a.label).type.localeCompare(shortName(b.label).type),
  );
  const wanted = query.trim().toLowerCase();
  const shown = sorted.filter(({ label }) =>
    label.toLowerCase().includes(wanted),
  );
  return (
    <Stack gap="xs">
      <TextInput
        size="sm"
        value={query}
        onChange={(event) => setQuery(event.currentTarget.value)}
        aria-label="Filter the implementers"
        placeholder="Filter by name"
        data-autofocus
        leftSection={<IconSearch size={16} stroke={1.6} aria-hidden />}
        rightSection={
          query === '' ? null : (
            <ActionIcon
              variant="subtle"
              size="sm"
              aria-label="Clear the filter"
              onClick={() => setQuery('')}
            >
              <IconX size={14} stroke={1.6} aria-hidden />
            </ActionIcon>
          )
        }
      />
      {wanted !== '' && (
        <Text component="output" size="xs" c="dimmed">
          {`${shown.length} of ${items.length}`}
        </Text>
      )}
      <ul className={classes.list}>
        {shown.map(({ change, label, path }) => {
          const removed = change === 'removed' || undefined;
          // `a.b.C` reads as `C`, then where it sits, `a.b`, dimmed.
          const namespace = label.slice(0, Math.max(label.lastIndexOf('.'), 0));
          const content = (
            <>
              <span className={classes.label}>
                <span className={classes.name} data-removed={removed}>
                  <QualifiedName name={label} />
                </span>
                {namespace !== '' && (
                  <span className={classes.namespace}>{namespace}</span>
                )}
              </span>
              <ChangeBadge change={change} inline />
            </>
          );
          return (
            <li key={`${change}:${label}`}>
              <ElementTooltip name={label}>
                {path !== null && has(path) ? (
                  <UnstyledButton
                    className={classes.row}
                    onClick={() => {
                      onOpen();
                      select(path);
                    }}
                  >
                    {content}
                  </UnstyledButton>
                ) : (
                  <span className={classes.row}>{content}</span>
                )}
              </ElementTooltip>
            </li>
          );
        })}
      </ul>
    </Stack>
  );
}
