import { useState } from 'react';
import { counted } from '#/features/design-docs/ui/plural.ts';
import { describeFailure } from '#/shared/api/failure.ts';
import { Alert } from '#/shared/design-system/alert.tsx';
import { Button } from '#/shared/design-system/button.tsx';
import { Group } from '#/shared/design-system/group.tsx';
import { Modal } from '#/shared/design-system/modal.tsx';
import { Select } from '#/shared/design-system/select.tsx';
import { Stack } from '#/shared/design-system/stack.tsx';
import { Text } from '#/shared/design-system/text.tsx';
import type { DesignDocumentInput } from '#backend/app/design-docs/design-doc.ts';
import {
  movedIdOf,
  moveDestinationsOf,
  UNIT_LABEL,
  type UnitRef,
  unitNameOf,
  unitsWithin,
  violationsInWords,
} from '../../design-doc-edit.ts';
import { useDesignDocEdit, violationsIn } from '../../design-docs.api.ts';
import { addressOf, parentOf } from '../../element-id.ts';

/** The top of the design, as a value a select can hold. */
const TOP = '';

/**
 * Moves an element the design adds under another parent, chosen here or by
 * dropping it on one in the tree. What is under it moves with it, and
 * whatever names it follows.
 */
export function MoveModal({
  changeId,
  docId,
  document: doc,
  unit,
  to: proposed,
  onClose,
  onMoved,
}: {
  changeId: string;
  docId: string;
  document: DesignDocumentInput;
  unit: UnitRef;
  /** Where a drop proposes it goes; undefined when it is to be chosen. */
  to?: string | null;
  onClose: () => void;
  /** The element's id once it has moved, for the page to follow it there. */
  onMoved?: (id: string) => void;
}) {
  const destinations = moveDestinationsOf(doc, unit);
  // A drop has already said where: the dialog only confirms it.
  const proposedHere =
    proposed !== undefined && destinations.includes(proposed);
  const [to, setTo] = useState<string | null | undefined>(
    proposedHere ? proposed : undefined,
  );
  const save = useDesignDocEdit(changeId, docId);
  const [problems, setProblems] = useState<string[]>([]);
  const name = unitNameOf(doc, unit);
  const here = parentOf(unit.id);
  const within = unitsWithin(doc, unit);

  const confirm = () => {
    if (to === undefined) return;
    setProblems([]);
    save.mutate(
      { op: 'move', ref: unit, to },
      {
        onSuccess: () => {
          onClose();
          onMoved?.(movedIdOf(unit, to));
        },
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
      title={`Move ${UNIT_LABEL[unit.kind]}`}
      size="lg"
      centered
      closeOnClickOutside={!save.isPending}
    >
      <Stack gap="md">
        <Text size="sm">
          {`${name} is ${here === null ? 'at the top of the design' : `in ${addressOf(here)}`}.`}
        </Text>
        <Select
          label="Move to"
          placeholder="Choose where it goes"
          searchable
          allowDeselect={false}
          // Focused, it opens its list: only when there is a choice to make.
          data-autofocus={proposedHere ? undefined : true}
          nothingFoundMessage="Nowhere in this design is called that"
          data={destinations.map((destination) => ({
            value: destination ?? TOP,
            label:
              destination === null
                ? 'The top of the design'
                : addressOf(destination),
          }))}
          value={to === undefined ? null : (to ?? TOP)}
          onChange={(value) =>
            setTo(value === null ? undefined : value === TOP ? null : value)
          }
        />
        <Text size="sm" c="dimmed">
          {within > 0
            ? `The ${counted(within, 'element')} under it move with it, and whatever names them follows.`
            : 'Whatever names it follows.'}
        </Text>
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
            busy={save.isPending}
            disabled={to === undefined}
            onClick={confirm}
            data-autofocus={proposedHere || undefined}
          >
            Move
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}
