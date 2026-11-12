import type { UseFormReturnType } from '#/shared/design-system/form.ts';
import {
  type FieldSpec,
  type UnitDraft,
  type UnitFieldName,
  type UnitKind,
} from '../../design-doc-edit.ts';

/*
 * The editor's form for a unit, and what each field is labelled.
 */

export type UnitForm = UseFormReturnType<UnitDraft>;

const LABEL: Record<UnitFieldName, string> = {
  name: 'Name',
  stakeholder: 'Stakeholder',
  statement: 'Statement',
  definition: 'Definition',
  diagram: 'Diagram',
  type: 'Type',
  kind: 'Kind',
  description: 'Description',
  needs: 'Answers the needs',
  rationale: 'Rationale',
  steps: 'Steps',
  ref: 'Type',
  cardinality: 'How many',
};

export const labelOf = (kind: UnitKind, spec: FieldSpec): string =>
  kind === 'extends' ? 'Extends' : LABEL[spec.name];

export const valueProps = (form: UnitForm, path: string) => ({
  value: form.getInputProps(path).value as string,
  onChange: (event: { currentTarget: { value: string } }) =>
    form.setFieldValue(path, event.currentTarget.value),
});
