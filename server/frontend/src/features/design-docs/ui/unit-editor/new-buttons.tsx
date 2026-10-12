import { IconPlus } from '@tabler/icons-react';
import { useState } from 'react';
import { ActionIcon } from '#/shared/design-system/action-icon.tsx';
import { Button } from '#/shared/design-system/button.tsx';
import { Text } from '#/shared/design-system/text.tsx';
import { Tooltip } from '#/shared/design-system/tooltip.tsx';
import { newRuleOf, type PartOwner, rulesOf } from '../../design-doc-edit.ts';
import { useUnitEditing } from './unit-editing.ts';
import { useWritableUnit } from './writable-unit.ts';

/**
 * Adds a rule to an element at once, as "New rule", for its name and the
 * rest to be written in place. Nothing where the element may not be written.
 */
export function NewRuleButton({ owner }: { owner: PartOwner }) {
  const editing = useUnitEditing();
  const writable = useWritableUnit({ kind: owner.kind, id: owner.id });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  if (editing === null || writable === null) return null;
  const add = async () => {
    setBusy(true);
    setError(await editing.apply(newRuleOf(editing.document, owner)));
    setBusy(false);
  };
  return (
    <>
      <Button
        variant="subtle"
        size="xs"
        busy={busy}
        leftSection={<IconPlus size={14} aria-hidden />}
        onClick={() => void add()}
      >
        New rule
      </Button>
      {error !== null && (
        <Text component="span" size="xs" c="red">
          {error}
        </Text>
      )}
    </>
  );
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
  const writable = useWritableUnit({ kind: owner.kind, id: owner.id });
  if (editing === null || writable === null) return null;
  // A module's scenarios belong to its rules: the first, unless one is asked.
  const first = rulesOf(editing.document, owner)[0];
  const preset: PartOwner | null =
    owner.kind !== 'module' || owner.rule !== undefined
      ? owner
      : first === undefined
        ? null
        : { ...owner, rule: first };
  if (preset === null) return null;
  const add = () =>
    editing.write({ mode: 'add', kind: 'scenario', owner: preset });
  if (icon)
    return (
      <Tooltip label="New scenario" openDelay={300}>
        <ActionIcon
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
    <Button
      variant="subtle"
      size="xs"
      leftSection={<IconPlus size={14} aria-hidden />}
      onClick={add}
    >
      New scenario
    </Button>
  );
}
