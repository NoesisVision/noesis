import {
  type ReactNode,
  useEffect,
  useEffectEvent,
  useRef,
  useState,
} from 'react';
import { Text } from '#/shared/design-system/text.tsx';
import { MarkdownEditor } from '#/shared/ui/markdown-editor.tsx';
import { HoverMarks } from './hover-marks.tsx';
import classes from './inline-edit.module.css';

/**
 * Prose written in place: it reads as itself and is the button that opens
 * it — clicked, tapped, or focused and Enter or Space — while a link in it
 * still opens. Opened, it is the markdown editor, as tall as the text: a
 * click outside it, or Mod+Enter, saves; Escape leaves it as it was.
 */
export function InlineMarkdown({
  label,
  human = false,
  value,
  onSave,
  children,
}: {
  label: string;
  /** Whether a human wrote it: its figure shows beside the pencil. */
  human?: boolean;
  value: string;
  /** Saves the new text; answers what is wrong with it, or null. */
  onSave: (next: string) => Promise<string | null>;
  /** How the text reads while it is not being written. */
  children: ReactNode;
}) {
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const draft = useRef(value);
  const saving = useRef(false);
  const frame = useRef<HTMLDivElement>(null);

  const start = () => {
    draft.current = value;
    setError(null);
    setEditing(true);
  };
  const save = useEffectEvent(async () => {
    if (saving.current) return;
    if (draft.current.trim() === value.trim()) {
      setEditing(false);
      return;
    }
    saving.current = true;
    const problem = await onSave(draft.current);
    saving.current = false;
    if (problem === null) setEditing(false);
    else setError(problem);
  });

  // Done when the pointer or the focus goes elsewhere: a click past the
  // editor, or the focus moved out of it, saves. Its own popups — a link's dialog, a
  // menu — open at the end of the page, and are still the editor.
  useEffect(() => {
    if (!editing) return;
    const inside = (target: EventTarget | null) =>
      target instanceof Node &&
      (frame.current?.contains(target) === true ||
        (target instanceof Element &&
          target.closest('.mdxeditor-popup-container') !== null));
    const onPointer = (event: PointerEvent) => {
      if (!inside(event.target)) void save();
    };
    const onFocus = (event: FocusEvent) => {
      if (event.relatedTarget !== null && !inside(event.relatedTarget))
        void save();
    };
    // Escape leaves the text as it was; Mod+Enter saves it — Tab is the
    // editor's own, indenting a list, so the keyboard leaves by these.
    // Heard on the way in, before the editor takes the keys for its own.
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        setEditing(false);
      } else if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
        event.preventDefault();
        void save();
      }
    };
    const root = frame.current;
    document.addEventListener('pointerdown', onPointer, true);
    root?.addEventListener('focusout', onFocus);
    root?.addEventListener('keydown', onKey, true);
    return () => {
      document.removeEventListener('pointerdown', onPointer, true);
      root?.removeEventListener('focusout', onFocus);
      root?.removeEventListener('keydown', onKey, true);
    };
  }, [editing]);

  // A link in the prose is followed, not written.
  const onLink = (target: EventTarget) =>
    target instanceof Element && target.closest('a') !== null;
  if (!editing)
    return (
      <div
        // The prose itself opens the editor, so it is the button: one tab
        // stop, Enter or Space, a click or a tap. A native button cannot
        // hold the links prose may have, which keep their own tab stops.
        // oxlint-disable-next-line jsx-a11y/prefer-tag-over-role
        role="button"
        tabIndex={0}
        aria-label={`Edit the ${label.toLowerCase()}`}
        data-edit={label.toLowerCase()}
        className={classes.block}
        onClick={(event) => {
          if (!onLink(event.target)) start();
        }}
        onKeyDown={(event) => {
          // Only the block's own keys: Enter on a link inside follows it.
          if (event.target !== event.currentTarget) return;
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            start();
          }
        }}
      >
        {children}
        <HoverMarks editable human={human} />
      </div>
    );
  return (
    <div ref={frame}>
      <MarkdownEditor
        markdown={value}
        headingLevel={3}
        blockTypes={false}
        inline
        focusOnOpen
        onChange={(next) => {
          draft.current = next;
        }}
      />
      {error !== null && (
        <Text size="xs" c="red" mt={4}>
          {error}
        </Text>
      )}
    </div>
  );
}
