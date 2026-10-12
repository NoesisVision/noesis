import { clsx } from 'clsx';
import {
  type KeyboardEvent,
  type MouseEvent,
  type ReactNode,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';
import { Text } from '#/shared/design-system/text.tsx';
import { UnstyledButton } from '#/shared/design-system/unstyled-button.tsx';
import classes from './inline-edit.module.css';

/**
 * A text written where it stands: clicked, the text itself becomes editable —
 * same type, same place, the caret where the click fell — rather than giving
 * way to an input. Enter or leaving it saves — a paragraph takes Enter as a
 * new line, and saves on Ctrl or ⌘ with it — and Escape puts it back as it
 * was. What the save refuses stays open with the reason under it.
 *
 * Plain text only: what is pasted or typed arrives without formatting. While
 * it is written the text is the browser's, not React's; it is read back as
 * the save asks for it.
 */
export function InlineText({
  label,
  value,
  onSave,
  multiline = false,
  placeholder,
  className,
  children,
}: {
  /** What the text is, for whoever cannot see it: "Name", "Description". */
  label: string;
  value: string;
  /** Saves the new text; answers what is wrong with it, or null. */
  onSave: (next: string) => Promise<string | null>;
  multiline?: boolean;
  /** Shown, dimmed, while there is nothing written. */
  placeholder?: string;
  className?: string;
  /** How the text reads while it is not being written; the text by default. */
  children?: ReactNode;
}) {
  // The text the field opened with, rendered once: what is typed after is
  // the browser's, and a render must not put this back over it.
  const [editing, setEditing] = useState<{ text: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const field = useRef<HTMLSpanElement>(null);
  // Where the click that opened it fell, for the caret to land there.
  const point = useRef<{ x: number; y: number } | null>(null);
  // Escape leaves the field, and leaving it must not then save.
  const cancelled = useRef(false);

  useLayoutEffect(() => {
    const element = field.current;
    if (editing === null || element === null) return;
    element.focus();
    placeCaret(element, point.current);
  }, [editing]);

  const start = (event: MouseEvent) => {
    // A click from the keyboard has no place on screen: the caret goes last.
    point.current =
      event.detail === 0 ? null : { x: event.clientX, y: event.clientY };
    cancelled.current = false;
    setError(null);
    setEditing({ text: value });
  };
  const written = () => {
    const text = field.current?.textContent ?? '';
    return multiline ? text : text.replaceAll(/\s*\n\s*/g, ' ');
  };
  const commit = async () => {
    if (cancelled.current || busy) return;
    const next = written();
    if (next.trim() === value.trim()) {
      setEditing(null);
      return;
    }
    setBusy(true);
    const problem = await onSave(next.trim());
    setBusy(false);
    if (problem === null) setEditing(null);
    else setError(problem);
  };
  const onKeyDown = (event: KeyboardEvent) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      cancelled.current = true;
      setEditing(null);
    } else if (
      event.key === 'Enter' &&
      (!multiline || event.metaKey || event.ctrlKey)
    ) {
      event.preventDefault();
      void commit();
    }
  };

  if (editing === null) {
    const empty = value.trim() === '';
    return (
      <UnstyledButton
        className={clsx(classes.editable, empty && classes.empty, className)}
        title={`Edit the ${label.toLowerCase()}`}
        onClick={start}
      >
        {empty
          ? (placeholder ?? `No ${label.toLowerCase()}`)
          : (children ?? value)}
      </UnstyledButton>
    );
  }
  return (
    <>
      <span
        ref={field}
        // The text itself is the field, so it is the textbox: an input in
        // its place is what this is here to avoid.
        // oxlint-disable-next-line jsx-a11y/prefer-tag-over-role
        role="textbox"
        aria-label={label}
        aria-multiline={multiline || undefined}
        aria-invalid={error !== null || undefined}
        aria-busy={busy || undefined}
        contentEditable={busy ? false : 'plaintext-only'}
        suppressContentEditableWarning
        spellCheck
        tabIndex={0}
        data-placeholder={placeholder ?? `No ${label.toLowerCase()}`}
        data-multiline={multiline || undefined}
        className={clsx(classes.editing, className)}
        onKeyDown={onKeyDown}
        onBlur={() => void commit()}
      >
        {editing.text}
      </span>
      {error !== null && (
        <Text component="span" display="block" size="xs" c="red">
          {error}
        </Text>
      )}
    </>
  );
}

/** The caret where the click fell inside the text, or after its last letter. */
function placeCaret(
  element: HTMLElement,
  point: { x: number; y: number } | null,
) {
  const selection = window.getSelection();
  if (selection === null) return;
  const range = rangeAt(point) ?? document.createRange();
  if (!element.contains(range.startContainer)) {
    range.selectNodeContents(element);
    range.collapse(false);
  }
  selection.removeAllRanges();
  selection.addRange(range);
}

function rangeAt(point: { x: number; y: number } | null): Range | null {
  if (point === null) return null;
  if (typeof document.caretPositionFromPoint === 'function') {
    const position = document.caretPositionFromPoint(point.x, point.y);
    if (position === null) return null;
    const range = document.createRange();
    range.setStart(position.offsetNode, position.offset);
    range.collapse(true);
    return range;
  }
  return document.caretRangeFromPoint?.(point.x, point.y) ?? null;
}
