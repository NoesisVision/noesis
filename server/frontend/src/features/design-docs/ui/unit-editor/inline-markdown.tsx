import { type MouseEvent, type ReactNode, useState } from 'react';
import { Button } from '#/shared/design-system/button.tsx';
import { Group } from '#/shared/design-system/group.tsx';
import { Stack } from '#/shared/design-system/stack.tsx';
import { Text } from '#/shared/design-system/text.tsx';
import { UnstyledButton } from '#/shared/design-system/unstyled-button.tsx';
import { MarkdownEditor } from '#/shared/ui/markdown-editor.tsx';
import classes from './inline-edit.module.css';

/**
 * Prose written in place: it reads as itself until it is clicked, then it is
 * the markdown editor, kept until Save or Cancel — a paragraph half written
 * is not one to save on the way out. A link in it still opens; the keyboard
 * gets a button of its own, out of sight until it has focus.
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
  const onClick = (event: MouseEvent) => {
    // A link is followed, not written.
    if ((event.target as HTMLElement).closest('a')) return;
    start();
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

  if (!editing)
    return (
      <>
        <UnstyledButton className={classes.keyboardOnly} onClick={start}>
          {`Edit the ${label.toLowerCase()}`}
        </UnstyledButton>
        {/* The pointer's way in; the keyboard's is the button above. */}
        {/* oxlint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions */}
        <div
          className={classes.block}
          title={`Edit the ${label.toLowerCase()}`}
          onClick={onClick}
        >
          {children}
        </div>
      </>
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
