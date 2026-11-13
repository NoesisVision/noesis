import { useState } from 'react';
import { Stack } from '#/shared/design-system/stack.tsx';
import { TextInput } from '#/shared/design-system/text-input.tsx';
import type { DesignDocumentInput } from '#backend/app/design-docs/design-doc.ts';
import {
  fieldOf,
  isEditableField,
  needIdOf,
  UNIT_FIELDS,
  type Unit,
  type UnitKind,
  type UnitState,
} from '../../design-doc-edit.ts';
import { authorOf, fieldFrom } from '../../design-doc-field.ts';
import { DesignedField } from './designed-field.tsx';
import { FieldInput } from './field-input.tsx';
import { labelOf, type UnitForm } from './unit-form.ts';

export * from './unit-form.ts';
export * from './ref-input.tsx';
export * from './diagram-input.tsx';
export * from './field-input.tsx';

/**
 * The fields of one unit, each in the input its value needs. A part's key is
 * fixed once the model has the part; a new need takes its id from its name
 * until its writer chooses one.
 */
export function UnitFields({
  kind,
  form,
  original,
  state,
  document: doc,
  newNeed,
}: {
  kind: UnitKind;
  form: UnitForm;
  /** The unit as the design writes it now; null for a new one. */
  original: Unit | null;
  state: UnitState;
  document: DesignDocumentInput;
  newNeed: boolean;
}) {
  const [idChosen, setIdChosen] = useState(false);
  const revisable = state !== 'added';
  return (
    <Stack gap="md">
      {UNIT_FIELDS[kind].map((spec) => {
        const draft = form.values.fields[spec.name]!;
        const originalField =
          original === null || spec.key
            ? undefined
            : fieldOf(original, spec.prop);
        return (
          <DesignedField
            key={spec.name}
            label={labelOf(kind, spec)}
            written={draft.written}
            revisable={revisable && !spec.key}
            author={
              spec.key
                ? null
                : authorOf(fieldFrom<unknown>(draft, originalField))
            }
            error={form.errors[`fields.${spec.name}.value`]}
            onWrite={() =>
              form.setFieldValue(`fields.${spec.name}.written`, true)
            }
            onReset={() =>
              form.setFieldValue(`fields.${spec.name}.written`, false)
            }
          >
            <FieldInput
              kind={kind}
              spec={spec}
              form={form}
              document={doc}
              disabled={!isEditableField(spec, state)}
              onName={
                newNeed && !idChosen
                  ? (name) => form.setFieldValue('id', needIdOf(name))
                  : undefined
              }
            />
          </DesignedField>
        );
      })}
      {newNeed && (
        <TextInput
          label="Id"
          description="How rules name the need. It cannot change once the need is saved."
          {...form.getInputProps('id')}
          onChange={(event) => {
            setIdChosen(true);
            form.setFieldValue('id', event.currentTarget.value);
          }}
        />
      )}
    </Stack>
  );
}
