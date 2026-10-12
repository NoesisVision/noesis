import { IconHierarchy2, IconPlus } from '@tabler/icons-react';
import { useState } from 'react';
import { KindIcon } from '#/features/design-docs/ui/model-tree/kind-icon.tsx';
import type { OutlineKind } from '#/features/design-docs/ui/model-tree/model-outline.ts';
import { describeFailure } from '#/shared/api/failure.ts';
import { Alert } from '#/shared/design-system/alert.tsx';
import { Button } from '#/shared/design-system/button.tsx';
import { useForm } from '#/shared/design-system/form.ts';
import { Select } from '#/shared/design-system/select.tsx';
import { Stack } from '#/shared/design-system/stack.tsx';
import { Text } from '#/shared/design-system/text.tsx';
import {
  ModalBody,
  ModalFooter,
  ModalFrame,
} from '#/shared/ui/modal-frame.tsx';
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
  type UnitKind,
  type UnitTarget,
  unitFromDraft,
  unitOf,
  unitStateOf,
  violationsOf,
} from '../../design-doc-edit.ts';
import { useDesignDocEdit, violationsIn } from '../../design-docs.api.ts';
import { ChangeBadge } from '../element-details/change-badge.tsx';
import { ScenarioFields } from './scenario-fields.tsx';
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
  const named =
    ((form.values.fields.name?.value as string | undefined) ?? '').trim() !==
    '';
  return (
    <ModalFrame
      onClose={onClose}
      icon={<KindIcon kind={ICON_KIND[kind]} pattern={null} />}
      title={`${verb} ${UNIT_LABEL[kind]}`}
      badge={ref === null ? undefined : <ChangeBadge change={state} inline />}
      busy={save.isPending}
    >
      <form onSubmit={submit} noValidate>
        <ModalBody>
          {kind === 'scenario' ? (
            <ScenarioFields
              form={form}
              state={state}
              nameLocked={target.mode === 'edit' && state !== 'added'}
              belongsTo={
                owner !== null && (
                  <ScenarioRuleField
                    document={doc}
                    owner={owner}
                    // The model knows a scenario it has by its rule: only a new
                    // one, or one the design adds, may go to another.
                    locked={target.mode === 'edit' && state !== 'added'}
                    onChange={setOwner}
                  />
                )
              }
            />
          ) : (
            <UnitFields
              kind={kind}
              form={form}
              original={original}
              state={state}
              document={doc}
              owner={ownerOf(target)}
              newNeed={kind === 'need' && target.mode === 'add'}
            />
          )}
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
        </ModalBody>
        <ModalFooter
          note={
            named
              ? `Ready to ${target.mode === 'add' ? 'add' : 'save'}.`
              : 'A name is required.'
          }
        >
          <Button variant="default" onClick={onClose} disabled={save.isPending}>
            Cancel
          </Button>
          <Button
            type="submit"
            busy={save.isPending}
            disabled={!named}
            leftSection={
              target.mode === 'add' ? (
                <IconPlus size={16} aria-hidden />
              ) : undefined
            }
          >
            {target.mode === 'add' ? `Add ${UNIT_LABEL[kind]}` : 'Save'}
          </Button>
        </ModalFooter>
      </form>
    </ModalFrame>
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
      leftSection={<IconHierarchy2 size={16} aria-hidden />}
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
