import { IconPlus } from '@tabler/icons-react';
import { clsx } from 'clsx';
import { useEffect, useRef, useState } from 'react';
import { ActionIcon } from '#/shared/design-system/action-icon.tsx';
import { Button } from '#/shared/design-system/button.tsx';
import { Group } from '#/shared/design-system/group.tsx';
import { Textarea } from '#/shared/design-system/textarea.tsx';
import { Tooltip } from '#/shared/design-system/tooltip.tsx';
import { UnstyledButton } from '#/shared/design-system/unstyled-button.tsx';
import { newRuleOf, type PartOwner, rulesOf } from '../../design-doc-edit.ts';
import { useUnitEditing } from './unit-editing.ts';
import { useWritableUnit } from './writable-unit.ts';
import classes from './add-item.module.css';
import quiet from './icon-button.module.css';

/**
 * Adds a rule where the next one goes: a ghost row that opens, in place, into
 * a box for the rule's name, with Cancel and Add rule. Enter adds it, Escape
 * lets it go; the rest of the rule is written on its card. Nothing where the
 * element may not be written.
 */
export function NewRuleButton({ owner }: { owner: PartOwner }) {
  const editing = useUnitEditing();
  const writable = useWritableUnit({ kind: owner.kind, id: owner.id });
  const [draft, setDraft] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const field = useRef<HTMLTextAreaElement>(null);
  // Opened, the box takes the focus for the name to be typed straight in.
  const drafting = draft !== null;
  useEffect(() => {
    if (drafting) field.current?.focus();
  }, [drafting]);
  if (editing === null || writable === null) return null;
  const name = draft?.trim() ?? '';
  const close = () => {
    setDraft(null);
    setError(null);
  };
  const add = async () => {
    if (name === '' || busy) return;
    if (rulesOf(editing.document, owner).includes(name)) {
      setError(`A rule is already called ${name}.`);
      return;
    }
    setBusy(true);
    const problem = await editing.apply(
      newRuleOf(editing.document, owner, name),
    );
    setBusy(false);
    if (problem === null) close();
    else setError(problem);
  };
  if (draft === null)
    return (
      <UnstyledButton className={classes.ghost} onClick={() => setDraft('')}>
        <IconPlus size={16} aria-hidden />
        Add rule
      </UnstyledButton>
    );
  return (
    <div className={classes.draft}>
      <Textarea
        ref={field}
        label="Rule name"
        description="What must always hold. Its kind, description and needs are written on its card after."
        placeholder="e.g. Value must not be empty"
        autosize
        minRows={2}
        value={draft}
        error={error ?? undefined}
        disabled={busy}
        onChange={(event) => {
          setDraft(event.currentTarget.value);
          setError(null);
        }}
        onKeyDown={(event) => {
          if (event.key === 'Escape') {
            event.stopPropagation();
            close();
          } else if (event.key === 'Enter' && !event.shiftKey) {
            event.preventDefault();
            void add();
          }
        }}
      />
      <Group justify="flex-end" gap="xs">
        <Button variant="default" size="xs" disabled={busy} onClick={close}>
          Cancel
        </Button>
        <Button
          size="xs"
          busy={busy}
          disabled={name === ''}
          onClick={() => void add()}
        >
          Add rule
        </Button>
      </Group>
    </div>
  );
}

/**
 * Where a new scenario of this element is written — under the rule asked, or
 * a module's first; null where none may be added: the document read only,
 * the element not writable, or a module with no rule to put one under.
 */
export function useNewScenarioOwner(
  owner: PartOwner | undefined,
): PartOwner | null {
  const editing = useUnitEditing();
  const writable = useWritableUnit(
    owner === undefined ? null : { kind: owner.kind, id: owner.id },
  );
  if (editing === null || writable === null || owner === undefined) return null;
  // A module's scenarios belong to its rules: the first, unless one is asked.
  const first = rulesOf(editing.document, owner)[0];
  if (owner.kind !== 'module' || owner.rule !== undefined) return owner;
  return first === undefined ? null : { ...owner, rule: first };
}

/**
 * Opens the form on a new scenario, its rule chosen already — the one it is
 * asked from — and changeable in the form. Nothing where the element may not
 * be written. As an icon, it sits among a card's own buttons.
 */
export function NewScenarioButton({
  owner,
  icon = false,
}: {
  owner: PartOwner;
  icon?: boolean;
}) {
  const editing = useUnitEditing();
  const preset = useNewScenarioOwner(owner);
  if (editing === null || preset === null) return null;
  const add = () =>
    editing.write({ mode: 'add', kind: 'scenario', owner: preset });
  if (icon)
    return (
      <Tooltip label="New scenario" openDelay={300}>
        <ActionIcon
          className={quiet.quiet}
          variant="subtle"
          size="md"
          aria-label={`New scenario${preset.rule === undefined ? '' : ` for the rule ${preset.rule}`}`}
          onClick={add}
        >
          <IconPlus size={18} aria-hidden />
        </ActionIcon>
      </Tooltip>
    );
  return (
    <UnstyledButton
      className={clsx(classes.ghost, classes.inset)}
      onClick={add}
    >
      <IconPlus size={16} aria-hidden />
      Add scenario
    </UnstyledButton>
  );
}
