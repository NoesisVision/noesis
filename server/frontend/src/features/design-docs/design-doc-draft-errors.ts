import type { DesignDocumentInput } from '#backend/app/design-docs/design-doc.ts';
import { unitStateOf } from './design-doc-change-sets.ts';
import { idOfDraft, type UnitDraft } from './design-doc-drafts.ts';
import {
  kindOfTarget,
  refOfTarget,
  UNIT_LABEL,
  type UnitTarget,
} from './design-doc-unit.ts';

/*
 * What is wrong with a draft before it is written, field by field.
 */

const NAME_SEPARATORS = /[.|]/;

const NEED_ID = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/** What the draft gets wrong before the server is asked, by form path. */
export function draftErrors(
  doc: DesignDocumentInput,
  target: UnitTarget,
  draft: UnitDraft,
): Record<string, string> {
  const kind = kindOfTarget(target);
  const errors: Record<string, string> = {};
  const { name, type, ref, steps } = draft.fields;
  const ruleKind = draft.fields.kind;
  if (name?.written) {
    if (name.value.trim() === '')
      errors['fields.name.value'] = 'A name is required.';
    else if (NAME_SEPARATORS.test(name.value))
      errors['fields.name.value'] = "A name cannot contain '.' or '|'.";
  }
  if (type?.written && type.value === '')
    errors['fields.type.value'] = 'Choose a type.';
  if (ref?.written && ref.value === '')
    errors['fields.ref.value'] = 'Choose a type.';
  if (
    draft.fields.cardinality?.written &&
    draft.fields.cardinality.value === ''
  )
    errors['fields.cardinality.value'] = 'Choose how many it holds.';
  if (ruleKind?.written && ruleKind.value === '')
    errors['fields.kind.value'] = 'Choose a kind.';
  if (steps?.written) {
    if (steps.value.length === 0)
      errors['fields.steps.value'] = 'A scenario needs at least one step.';
    steps.value.forEach((step, index) => {
      if (step.text.trim() === '')
        errors[`fields.steps.value.${index}.text`] =
          'Write this step, or remove it.';
    });
  }
  if (
    kind === 'need' &&
    target.mode === 'add' &&
    !NEED_ID.test(draft.id.trim())
  )
    errors.id = "Lower-case words joined by '-', e.g. 'start-a-refund'.";
  if (Object.keys(errors).length > 0) return errors;

  const id = idOfDraft(doc, target, draft);
  const unchangedId = target.mode === 'edit' && target.ref.id === id;
  if (
    !unchangedId &&
    unitStateOf(doc, refOfTarget(target, id)) !== 'unchanged'
  ) {
    const at =
      kind === 'need'
        ? 'id'
        : draft.fields.name
          ? 'fields.name.value'
          : 'fields.ref.value';
    errors[at] =
      `This design already has ${kind === 'need' ? 'a need with this id' : `this ${UNIT_LABEL[kind]} here`}.`;
  }
  return errors;
}
