import { useState } from 'react';
import { KindIcon } from '#/features/design-docs/ui/model-tree/kind-icon.tsx';
import type { OutlineKind } from '#/features/design-docs/ui/model-tree/model-outline.ts';
import { describeFailure } from '#/shared/api/failure.ts';
import { Alert } from '#/shared/design-system/alert.tsx';
import { Button } from '#/shared/design-system/button.tsx';
import { useForm } from '#/shared/design-system/form.ts';
import { Group } from '#/shared/design-system/group.tsx';
import { Modal } from '#/shared/design-system/modal.tsx';
import { Stack } from '#/shared/design-system/stack.tsx';
import { Text } from '#/shared/design-system/text.tsx';
import type { DesignDocumentInput } from '#backend/app/design-docs/design-doc.ts';
import {
  type DesignDocEdit,
  draftErrors,
  draftOfUnit,
  idOfDraft,
  kindOfTarget,
  type PartOwner,
  refOfTarget,
  type UnitKind,
  UNIT_LABEL,
  type UnitDraft,
  type UnitTarget,
  unitFromDraft,
  unitNameOf,
  unitOf,
  unitStateOf,
  violationsOf,
} from '../../design-doc-edit.ts';
import { useDesignDocEdit, violationsIn } from '../../design-docs.api.ts';
import { addressOf, nameOf } from '../../element-id.ts';
import { ChangeBadge } from '../element-details/change-badge.tsx';
import { UnitFields } from './unit-fields.tsx';

/**
 * Adds a unit or revises one, whatever its kind: the kind decides the fields,
 * the rest is the same for all. What the server refuses lands on the field it
 * names, or above the buttons when it names none.
 */
export function UnitEditorModal({
  changeId,
  docId,
  document: doc,
  target,
  onClose,
}: {
  changeId: string;
  docId: string;
  document: DesignDocumentInput;
  target: UnitTarget;
  onClose: () => void;
}) {
  const kind = kindOfTarget(target);
  const ref = target.mode === 'edit' ? target.ref : null;
  const original = ref === null ? null : unitOf(doc, ref);
  const state = ref === null ? 'added' : unitStateOf(doc, ref);
  const form = useForm<UnitDraft>({
    initialValues: draftOfUnit(kind, original, state),
    validate: (draft) => draftErrors(doc, target, draft),
  });
  const save = useDesignDocEdit(changeId, docId);
  const [problems, setProblems] = useState<string[]>([]);

  const submit = form.onSubmit((draft) => {
    const id = idOfDraft(doc, target, draft);
    const unit = unitFromDraft(kind, draft, original, id);
    const edit: DesignDocEdit =
      target.mode === 'add'
        ? { op: 'add', ref: refOfTarget(target, id), unit }
        : { op: 'write', ref: target.ref, unit };
    setProblems([]);
    save.mutate(edit, {
      onSuccess: onClose,
      onError: (error) => {
        const violations = violationsIn(error);
        if (violations === null) {
          setProblems([describeFailure(error).description]);
          return;
        }
        const savedAs = state === 'unchanged' ? 'modified' : state;
        const { fields, rest } = violationsOf(
          doc,
          refOfTarget(target, id),
          savedAs,
          violations,
        );
        form.setErrors(fields);
        setProblems(rest);
      },
    });
  });

  const verb = target.mode === 'add' ? 'Add' : 'Edit';
  return (
    <Modal
      opened
      onClose={onClose}
      title={`${verb} ${UNIT_LABEL[kind]}`}
      size="lg"
      centered
      closeOnClickOutside={!save.isPending}
    >
      <form onSubmit={submit} noValidate>
        <Stack gap="md">
          <Group gap="xs" wrap="nowrap">
            <KindIcon kind={ICON_KIND[kind]} pattern={null} />
            <Text size="sm" c="dimmed" truncate>
              {placeOf(doc, target)}
            </Text>
            {ref !== null && <ChangeBadge change={state} />}
          </Group>
          <UnitFields
            kind={kind}
            form={form}
            original={original}
            state={state}
            document={doc}
            owner={ownerOf(target)}
            newNeed={kind === 'need' && target.mode === 'add'}
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
            <Button
              variant="default"
              onClick={onClose}
              disabled={save.isPending}
            >
              Cancel
            </Button>
            <Button type="submit" busy={save.isPending}>
              {target.mode === 'add' ? 'Add' : 'Save'}
            </Button>
          </Group>
        </Stack>
      </form>
    </Modal>
  );
}

/** The icon a unit's kind is drawn with: a part that is no row of the tree borrows one. */
const ICON_KIND: Record<UnitKind, OutlineKind> = {
  need: 'need',
  module: 'module',
  building_block: 'building_block',
  behaviour: 'behaviour',
  rule: 'rule',
  scenario: 'scenario',
  property: 'property',
  parameter: 'property',
  result: 'property',
  implements: 'building_block',
};

const ownerOf = (target: UnitTarget): PartOwner | null => {
  if (target.mode === 'add') return 'owner' in target ? target.owner : null;
  return 'owner' in target.ref ? target.ref.owner : null;
};

/** Where the unit is, or is going: under what, or by its own name. */
function placeOf(doc: DesignDocumentInput, target: UnitTarget): string {
  const owner = ownerOf(target);
  const within =
    owner === null
      ? null
      : `${nameOf(owner.id)}${owner.rule === undefined ? '' : ` · ${owner.rule}`}`;
  if (target.mode === 'edit')
    return within === null
      ? unitNameOf(doc, target.ref)
      : `${unitNameOf(doc, target.ref)} · in ${within}`;
  if (within !== null) return `In ${within}`;
  const parent = 'parent' in target ? target.parent : null;
  return parent === null
    ? 'At the top of the design'
    : `In ${addressOf(parent)}`;
}
