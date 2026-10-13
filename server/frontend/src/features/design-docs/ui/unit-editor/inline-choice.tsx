import { clsx } from 'clsx';
import {
  type ComponentProps,
  type ReactNode,
  useEffect,
  useRef,
  useState,
} from 'react';
import { Select } from '#/shared/design-system/select.tsx';
import { Stack } from '#/shared/design-system/stack.tsx';
import { Text } from '#/shared/design-system/text.tsx';
import { UnstyledButton } from '#/shared/design-system/unstyled-button.tsx';
import { HoverMarks } from './hover-marks.tsx';
import classes from './inline-edit.module.css';

/**
 * A value picked in place: it reads as itself until it is clicked, then it is
 * a list, already open. Picking saves; closing the list, or leaving it, keeps
 * what was there.
 */
export function InlineChoice({
  label,
  human = false,
  value,
  data,
  onSave,
  searchable = false,
  className,
  children,
}: {
  label: string;
  /** Whether a human wrote it: its figure shows beside the pencil. */
  human?: boolean;
  value: string | null;
  data: ComponentProps<typeof Select>['data'];
  /** Saves the value picked; answers what is wrong with it, or null. */
  onSave: (next: string) => Promise<string | null>;
  searchable?: boolean;
  className?: string;
  /** How the value reads while it is not being picked. */
  children: ReactNode;
}) {
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  // Opened by a click on the value, the list takes the focus it came with,
  // and what is typed replaces the value rather than running on after it.
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (!editing) return;
    input.current?.focus();
    input.current?.select();
  }, [editing]);

  const pick = async (next: string | null) => {
    if (next === null || next === value) {
      setEditing(false);
      return;
    }
    setBusy(true);
    const problem = await onSave(next);
    setBusy(false);
    if (problem === null) setEditing(false);
    else setError(problem);
  };

  if (!editing)
    return (
      <UnstyledButton
        className={clsx(classes.editable, className)}
        data-edit={label.toLowerCase()}
        onClick={() => {
          setError(null);
          setEditing(true);
        }}
      >
        {children}
        <HoverMarks editable human={human} />
      </UnstyledButton>
    );
  return (
    <Stack gap={4} className={clsx(classes.field, className)}>
      <Select
        ref={input}
        aria-label={label}
        defaultDropdownOpened
        searchable={searchable}
        size="xs"
        allowDeselect={false}
        disabled={busy}
        error={error !== null}
        data={data}
        value={value}
        onChange={(next) => void pick(next === null ? null : String(next))}
        onDropdownClose={() => {
          if (!busy && error === null) setEditing(false);
        }}
        onBlur={() => {
          if (!busy) setEditing(false);
        }}
      />
      {error !== null && (
        <Text size="xs" c="red">
          {error}
        </Text>
      )}
    </Stack>
  );
}
