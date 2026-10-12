import { clsx } from 'clsx';
import {
  type FocusEvent,
  type KeyboardEvent,
  type ReactNode,
  useEffect,
  useRef,
  useState,
} from 'react';
import { Chip } from '#/shared/design-system/chip.tsx';
import { Group } from '#/shared/design-system/group.tsx';
import { Stack } from '#/shared/design-system/stack.tsx';
import { Text } from '#/shared/design-system/text.tsx';
import { UnstyledButton } from '#/shared/design-system/unstyled-button.tsx';
import classes from './inline-edit.module.css';

/**
 * Several values picked in place: they read as themselves until clicked,
 * then every choice is a chip, the picked ones on. Each chip saves as it is
 * turned; Escape, or leaving the chips, closes them.
 */
export function InlineChips({
  label,
  value,
  data,
  onSave,
  className,
  children,
}: {
  label: string;
  value: string[];
  data: { value: string; label: string }[];
  /** Saves what is picked; answers what is wrong with it, or null. */
  onSave: (next: string[]) => Promise<string | null>;
  className?: string;
  /** How the values read while they are not being picked. */
  children: ReactNode;
}) {
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  // Opened, the chips take the focus: the first of them.
  const group = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (editing) group.current?.querySelector('input')?.focus();
  }, [editing]);

  // A chip turned while the last one saves waits for none: it is not taken.
  // Disabled instead, the chips would lose the focus, and close.
  const pick = async (next: string[]) => {
    if (busy) return;
    setBusy(true);
    setError(await onSave(next));
    setBusy(false);
  };
  const close = () => {
    setError(null);
    setEditing(false);
  };
  const onBlur = (event: FocusEvent) => {
    if (!event.currentTarget.contains(event.relatedTarget as Node | null))
      close();
  };
  const onKeyDown = (event: KeyboardEvent) => {
    if (event.key !== 'Escape') return;
    event.stopPropagation();
    close();
  };

  if (!editing)
    return (
      <UnstyledButton
        className={clsx(classes.editable, className)}
        title={`Edit the ${label.toLowerCase()}`}
        onClick={() => setEditing(true)}
      >
        {children}
      </UnstyledButton>
    );
  return (
    <Stack
      ref={group}
      gap={4}
      className={className}
      onBlur={onBlur}
      onKeyDown={onKeyDown}
      // Pressing a chip keeps the focus where it is, or the chips close
      // before the press is taken.
      onMouseDown={(event) => event.preventDefault()}
    >
      <Chip.Group multiple value={value} onChange={(next) => void pick(next)}>
        <Group
          component="fieldset"
          aria-label={label}
          gap="xs"
          m={0}
          p={0}
          bd="none"
        >
          {data.map((choice) => (
            <Chip
              key={choice.value}
              value={choice.value}
              variant="outline"
              size="xs"
            >
              {choice.label}
            </Chip>
          ))}
        </Group>
      </Chip.Group>
      {error !== null && (
        <Text size="xs" c="red">
          {error}
        </Text>
      )}
    </Stack>
  );
}
