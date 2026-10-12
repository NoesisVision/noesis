import { useState } from 'react';
import { describeFailure } from '#/shared/api/failure.ts';
import { Alert } from '#/shared/design-system/alert.tsx';
import { Button } from '#/shared/design-system/button.tsx';
import { useForm } from '#/shared/design-system/form.ts';
import { Group } from '#/shared/design-system/group.tsx';
import { Modal } from '#/shared/design-system/modal.tsx';
import { Select } from '#/shared/design-system/select.tsx';
import { Stack } from '#/shared/design-system/stack.tsx';
import { Text } from '#/shared/design-system/text.tsx';
import { ModalTitle } from '#/shared/ui/modal-title.tsx';
import type { DesignDocumentInput } from '#backend/app/design-docs/design-doc.ts';
import {
  type DesignDocEdit,
  draftErrors,
  draftOfUnit,
  idOfDraft,
  kindOfTarget,
  type PartOwner,
  refOfTarget,
  rulesOf,
  UNIT_LABEL,
  type UnitDraft,
  type UnitTarget,
  unitFromDraft,
  unitOf,
  unitStateOf,
  violationsOf,
} from '../../design-doc-edit.ts';
import { useDesignDocEdit, violationsIn } from '../../design-docs.api.ts';
import { ChangeBadge } from '../element-details/change-badge.tsx';
import { UnitFields } from './unit-fields.tsx';
import { trailOfTarget } from './unit-trail.ts';

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
  });
  const save = useDesignDocEdit(changeId, docId);
  const [problems, setProblems] = useState<string[]>([]);
  // A scenario's rule is picked in the form; a new one, or one the design
  // adds, may go to another — the model knows one it has by where it is.
  const opened = ownerOf(target);
  const [owner, setOwner] = useState(opened);
  const relocates =
    kind === 'scenario' &&
    owner !== null &&
    opened !== null &&
    owner.rule !== opened.rule;
  // Where the unit is written: a scenario moved is new where it goes.
  const placed: UnitTarget =
    relocates || (target.mode === 'add' && owner !== null && 'owner' in target)
      ? { mode: 'add', kind: kind as 'scenario', owner: owner! }
      : target;

  const submit = form.onSubmit((draft) => {
    const errors = draftErrors(doc, placed, draft);
    if (Object.keys(errors).length > 0) {
      form.setErrors(errors);
      return;
    }
    const id = idOfDraft(doc, placed, draft);
    const unit = unitFromDraft(kind, draft, original, id);
    const edit: DesignDocEdit =
      target.mode === 'edit' && relocates
        ? {
            op: 'relocate',
            from: target.ref,
            ref: refOfTarget(placed, id),
            unit,
          }
        : placed.mode === 'add'
          ? { op: 'add', ref: refOfTarget(placed, id), unit }
          : { op: 'write', ref: placed.ref, unit };
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
          refOfTarget(placed, id),
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
      title={
        <ModalTitle trail={trailOfTarget(placed)}>
          {`${verb} ${UNIT_LABEL[kind]} `}
          {ref !== null && (
            // Seen beside the title; the dialog is named by the title alone.
            <span aria-hidden="true">
              <ChangeBadge change={state} inline />
            </span>
          )}
        </ModalTitle>
      }
      size="lg"
      centered
      closeOnClickOutside={!save.isPending}
    >
      <form onSubmit={submit} noValidate>
        <Stack gap="md">
          {kind === 'scenario' && owner !== null && (
            <ScenarioRuleField
              document={doc}
              owner={owner}
              // The model knows a scenario it has by its rule: only a new
              // one, or one the design adds, may go to another.
              locked={target.mode === 'edit' && state !== 'added'}
              onChange={setOwner}
            />
          )}
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

const ownerOf = (target: UnitTarget): PartOwner | null => {
  if (target.mode === 'add') return 'owner' in target ? target.owner : null;
  return 'owner' in target.ref ? target.ref.owner : null;
};

/** The element itself, as the scenario's place: no rule of it. */
const ITSELF = '';

/**
 * Which rule a scenario belongs to — or, in a building block or a behaviour,
 * the element itself, which holds scenarios of its own; a module does not.
 */
function ScenarioRuleField({
  document: doc,
  owner,
  locked,
  onChange,
}: {
  document: DesignDocumentInput;
  owner: PartOwner;
  locked: boolean;
  onChange: (owner: PartOwner) => void;
}) {
  const element = { kind: owner.kind, id: owner.id };
  const rules = rulesOf(doc, element);
  const data = [
    ...(owner.kind === 'module'
      ? []
      : [{ value: ITSELF, label: `The ${UNIT_LABEL[owner.kind]} itself` }]),
    ...rules.map((rule) => ({ value: rule, label: rule })),
  ];
  return (
    <Select
      label="Belongs to"
      description={
        locked
          ? 'The model knows this scenario by its rule, so it stays there.'
          : undefined
      }
      allowDeselect={false}
      disabled={locked}
      data={data}
      value={owner.rule ?? ITSELF}
      onChange={(value) =>
        onChange(
          value === null || value === ITSELF
            ? element
            : { ...element, rule: value },
        )
      }
    />
  );
}
