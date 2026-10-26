import { IconArrowsMove, IconCheck } from '@tabler/icons-react';
import { useState } from 'react';
import { describeFailure } from '#/shared/api/failure.ts';
import { Alert } from '#/shared/design-system/alert.tsx';
import { Button } from '#/shared/design-system/button.tsx';
import { Group } from '#/shared/design-system/group.tsx';
import {
  type ComboboxItem,
  type ComboboxParsedItem,
  type OptionsFilter,
  Select,
} from '#/shared/design-system/select.tsx';
import { Stack } from '#/shared/design-system/stack.tsx';
import { Text } from '#/shared/design-system/text.tsx';
import {
  ModalBody,
  ModalFooter,
  ModalFrame,
} from '#/shared/ui/modal-frame.tsx';
import type { DesignDocumentInput } from '#backend/app/design-docs/design-doc.ts';
import { findById } from '../../change-set.ts';
import {
  movedIdOf,
  moveDestinationsOf,
  type UnitRef,
  unitNameOf,
  violationsInWords,
} from '../../design-doc-edit.ts';
import { valueOf } from '../../design-doc-field.ts';
import { useDesignDocEdit, violationsIn } from '../../design-docs.api.ts';
import { addressOf, kindOf } from '../../element-id.ts';
import { KindIcon } from '../model-tree/kind-icon.tsx';
import classes from './move-modal.module.css';

/** The top of the design, as a value a select can hold. */
const TOP = '';

/**
 * The places, grouped by what holds them — `a.b.Service` under `a.b` — each
 * by its own name; the top of the design first, in a group of none.
 */
function choicesOf(destinations: readonly (string | null)[]) {
  const top = destinations.includes(null)
    ? [{ value: TOP, label: 'The top of the design' }]
    : [];
  const groups = new Map<string, { value: string; label: string }[]>();
  for (const destination of destinations) {
    if (destination === null) continue;
    const steps = addressOf(destination).split('.');
    const group = steps.slice(0, -1).join('.') || 'Top level';
    groups.set(group, [
      ...(groups.get(group) ?? []),
      { value: destination, label: steps.at(-1) ?? destination },
    ]);
  }
  return [...top, ...[...groups].map(([group, items]) => ({ group, items }))];
}

/** The icon the tree draws a place with: a module, or a block by its pattern. */
function PlaceIcon({
  document: doc,
  id,
}: {
  document: DesignDocumentInput;
  id: string;
}) {
  const kind = kindOf(id);
  const pattern =
    kind === 'building_block'
      ? (valueOf(findById(doc.buildingBlocks, id)?.type) ?? null)
      : null;
  return <KindIcon kind={kind} pattern={pattern} />;
}

/** What is typed finds a place by its whole address, not its name alone. */
const byAddress: OptionsFilter = ({ options, search }) => {
  const wanted = search.trim().toLowerCase();
  const fits = (option: ComboboxItem) =>
    (option.value === TOP ? option.label : addressOf(option.value))
      .toLowerCase()
      .includes(wanted);
  return options.flatMap((option): ComboboxParsedItem[] => {
    if (!('group' in option)) return fits(option) ? [option] : [];
    const items = option.items.filter(fits);
    return items.length > 0 ? [{ ...option, items }] : [];
  });
};

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
    <ModalFrame
      onClose={onClose}
      icon={<IconArrowsMove size={22} aria-hidden />}
      title={`Move "${name}"`}
      busy={save.isPending}
    >
      <ModalBody>
        <Select
          label="Move to"
          placeholder="Choose where it goes"
          searchable
          allowDeselect={false}
          // Focused, it opens its list: only when there is a choice to make.
          data-autofocus={proposedHere ? undefined : true}
          nothingFoundMessage="Nowhere in this design is called that"
          data={choicesOf(destinations)}
          filter={byAddress}
          classNames={{ groupLabel: classes.groupLabel }}
          renderOption={({ option, checked }) => (
            <Group gap="xs" wrap="nowrap">
              {/* The chosen place keeps the tick the list gives it otherwise, first. */}
              {checked && <IconCheck size={16} aria-hidden />}
              {option.value !== TOP && (
                <PlaceIcon document={doc} id={option.value} />
              )}
              {option.label}
            </Group>
          )}
          leftSection={
            to === undefined || to === null ? undefined : (
              <PlaceIcon document={doc} id={to} />
            )
          }
          value={to === undefined ? null : (to ?? TOP)}
          onChange={(value) =>
            setTo(value === null ? undefined : value === TOP ? null : value)
          }
        />
        {problems.length > 0 && (
          <Alert
            color="red"
            title="The design was not saved"
            withCloseButton
            closeButtonLabel="Dismiss"
            onClose={() => setProblems([])}
          >
            <Stack gap={4}>
              {problems.map((problem) => (
                <Text key={problem} size="sm">
                  {problem}
                </Text>
              ))}
            </Stack>
          </Alert>
        )}
      </ModalBody>
      <ModalFooter>
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
      </ModalFooter>
    </ModalFrame>
  );
}
