import { useState } from 'react';
import { counted } from '#/features/design-docs/ui/plural.ts';
import { describeFailure } from '#/shared/api/failure.ts';
import { Alert } from '#/shared/design-system/alert.tsx';
import { Button } from '#/shared/design-system/button.tsx';
import { Group } from '#/shared/design-system/group.tsx';
import { Modal } from '#/shared/design-system/modal.tsx';
import { Radio } from '#/shared/design-system/radio.tsx';
import { Stack } from '#/shared/design-system/stack.tsx';
import { Text } from '#/shared/design-system/text.tsx';
import type { DesignDocumentInput } from '#backend/app/design-docs/design-doc.ts';
import {
  type Removal,
  removalsOf,
  rulesTracing,
  UNIT_LABEL,
  type UnitRef,
  type UnitState,
  unitNameOf,
  unitStateOf,
  unitsWithin,
  violationsInWords,
} from '../../design-doc-edit.ts';
import { useDesignDocEdit, violationsIn } from '../../design-docs.api.ts';

const SITUATION: Record<UnitState, (name: string) => string> = {
  added: (name) =>
    `This design adds ${name}. Discarding it takes it out of the design.`,
  modified: (name) => `This design modifies ${name}.`,
  removed: (name) =>
    `This design removes ${name}. Restoring it keeps it in the system.`,
  unchanged: (name) =>
    `This design leaves ${name} as the model has it. Removing it makes the design delete it.`,
};

const CHOICE: Record<Removal, { label: string; action: string }> = {
  discard: { label: "Discard this design's changes to it", action: 'Discard' },
  removeFromSystem: { label: 'Remove it from the system', action: 'Remove' },
  restore: { label: 'Restore it', action: 'Restore' },
};

/**
 * Asks before a unit leaves the design, saying what goes with it. A modified
 * unit can go two ways — back to what the model says, or out of the system
 * — so the human picks; the gentler one is offered first.
 */
export function ConfirmRemovalModal({
  changeId,
  docId,
  document: doc,
  unit,
  onClose,
}: {
  changeId: string;
  docId: string;
  document: DesignDocumentInput;
  unit: UnitRef;
  onClose: () => void;
}) {
  const state = unitStateOf(doc, unit);
  const choices = removalsOf(state);
  const [choice, setChoice] = useState<Removal>(choices[0]!);
  const save = useDesignDocEdit(changeId, docId);
  const [problems, setProblems] = useState<string[]>([]);
  const name = unitNameOf(doc, unit);
  const label = UNIT_LABEL[unit.kind];

  const confirm = () => {
    setProblems([]);
    save.mutate(
      { op: choice, ref: unit },
      {
        onSuccess: onClose,
        onError: (error) => {
          const violations = violationsIn(error);
          setProblems(
            violations === null
              ? [describeFailure(error).description]
              : violationsInWords(violations),
          );
        },
      },
    );
  };

  return (
    <Modal
      opened
      onClose={onClose}
      title={`${state === 'removed' ? 'Restore' : 'Remove'} ${label}?`}
      centered
      closeOnClickOutside={!save.isPending}
    >
      <Stack gap="md">
        <Text size="sm">{SITUATION[state](name)}</Text>
        {choices.length > 1 && (
          <Radio.Group
            value={choice}
            onChange={(value) => setChoice(value as Removal)}
            aria-label={`What should this design do with ${name}?`}
          >
            <Stack gap="sm">
              <Radio
                value="discard"
                label={CHOICE.discard.label}
                description={`The model keeps ${name} as it is.`}
              />
              <Radio
                value="removeFromSystem"
                label={CHOICE.removeFromSystem.label}
                description={`The design deletes ${name}.`}
              />
            </Stack>
          </Radio.Group>
        )}
        <Consequences
          document={doc}
          unit={unit}
          choice={choice}
          state={state}
        />
        {problems.length > 0 && (
          <Alert color="red" title="The design was not saved">
            <Stack gap={4}>
              {problems.map((problem) => (
                <Text key={problem} size="sm">
                  {problem}
                </Text>
              ))}
            </Stack>
          </Alert>
        )}
        <Group justify="flex-end" gap="sm">
          <Button variant="default" onClick={onClose} disabled={save.isPending}>
            Cancel
          </Button>
          <Button
            color={choice === 'restore' ? undefined : 'red'}
            busy={save.isPending}
            onClick={confirm}
            data-autofocus
          >
            {CHOICE[choice].action}
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}

/** What else changes: the elements under it, or the rules that answered a need. */
function Consequences({
  document: doc,
  unit,
  choice,
  state,
}: {
  document: DesignDocumentInput;
  unit: UnitRef;
  choice: Removal;
  state: UnitState;
}) {
  if (unit.kind === 'need') {
    const rules = rulesTracing(doc, unit.id);
    if (rules.length === 0) return null;
    return (
      <Text size="sm" c="dimmed">
        {`${counted(rules.length, 'rule')} stop answering it: ${rules.join(', ')}.`}
      </Text>
    );
  }
  const cascades =
    choice === 'removeFromSystem' ||
    (choice === 'discard' && state === 'added');
  const within = unitsWithin(doc, unit);
  if (!cascades || within === 0) return null;
  return (
    <Text size="sm" c="dimmed">
      {`What this design says about the ${counted(within, unit.kind === 'rule' ? 'scenario' : 'element')} under it goes too.`}
    </Text>
  );
}
