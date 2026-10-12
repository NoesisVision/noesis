import { type ReactNode, useState } from 'react';
import { Button } from '#/shared/design-system/button.tsx';
import { Group } from '#/shared/design-system/group.tsx';
import { Stack } from '#/shared/design-system/stack.tsx';
import { Text } from '#/shared/design-system/text.tsx';
import { MarkdownEditor } from '#/shared/ui/markdown-editor.tsx';
import classes from './inline-edit.module.css';

/**
 * Prose written in place: it reads as itself and is the button that opens
 * it — clicked, tapped, or focused and Enter or Space — while a link in it
 * still opens. Opened, it is the markdown editor, kept until Save or Cancel:
 * a paragraph half written is not one to save on the way out.
 */
export function InlineMarkdown({
  label,
  value,
  onSave,
  children,
}: {
  label: string;
  value: string;
  /** Saves the new text; answers what is wrong with it, or null. */
  onSave: (next: string) => Promise<string | null>;
  /** How the text reads while it is not being written. */
  children: ReactNode;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const start = () => {
    setDraft(value);
    setError(null);
    setEditing(true);
  };
  const save = async () => {
    if (draft.trim() === value.trim()) {
      setEditing(false);
      return;
    }
    setBusy(true);
    const problem = await onSave(draft);
    setBusy(false);
    if (problem === null) setEditing(false);
    else setError(problem);
  };

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
        title={`Edit the ${label.toLowerCase()}`}
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
      </div>
    );
  return (
    <Stack gap="xs">
      <MarkdownEditor
        markdown={value}
        headingLevel={3}
        blockTypes={false}
        onChange={setDraft}
      />
      {error !== null && (
        <Text size="xs" c="red">
          {error}
        </Text>
      )}
      <Group gap="xs" justify="flex-end">
        <Button
          variant="default"
          size="xs"
          disabled={busy}
          onClick={() => setEditing(false)}
        >
          Cancel
        </Button>
        <Button size="xs" busy={busy} onClick={() => void save()}>
          Save
        </Button>
      </Group>
    </Stack>
  );
}
