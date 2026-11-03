import { useState } from 'react';
import { Chip } from '#/shared/design-system/chip.tsx';
import type { UseFormReturnType } from '#/shared/design-system/form.ts';
import { Group } from '#/shared/design-system/group.tsx';
import { useDebouncedValue } from '#/shared/design-system/hooks.ts';
import { Select } from '#/shared/design-system/select.tsx';
import { Stack } from '#/shared/design-system/stack.tsx';
import { TextInput } from '#/shared/design-system/text-input.tsx';
import { Text } from '#/shared/design-system/text.tsx';
import { Textarea } from '#/shared/design-system/textarea.tsx';
import { MarkdownEditor } from '#/shared/ui/markdown-editor.tsx';
import { MermaidDiagram } from '#/shared/ui/mermaid-diagram.tsx';
import { titleCase } from '#/shared/ui/title-case.ts';
import type { DesignDocumentInput } from '#backend/app/design-docs/design-doc.ts';
import { writtenIn } from '../../change-set.ts';
import {
  blocksNamedIn,
  type FieldSpec,
  fieldOf,
  isEditableField,
  needIdOf,
  PRIMITIVES,
  RULE_KINDS,
  TYPES_OF,
  UNIT_FIELDS,
  type Unit,
  type UnitDraft,
  type UnitFieldName,
  type UnitKind,
  type UnitState,
} from '../../design-doc-edit.ts';
import { authorOf, fieldFrom, valueOf } from '../../design-doc-field.ts';
import { addressOf, nameOf } from '../../element-id.ts';
import { CARDINALITIES } from '../../relations.ts';
import { ruleKindLabelOf } from '../../rules.ts';
import { DesignedField } from './designed-field.tsx';
import { ScenarioStepsInput } from './scenario-fields.tsx';

type UnitForm = UseFormReturnType<UnitDraft>;

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

const labelOf = (kind: UnitKind, spec: FieldSpec): string =>
  kind === 'extends'
    ? 'Extends'
    : kind === 'collaborator' && spec.name === 'ref'
      ? 'Has collaborator'
      : LABEL[spec.name];

function FieldInput({
  kind,
  spec,
  form,
  document: doc,
  disabled,
  onName,
}: {
  kind: UnitKind;
  spec: FieldSpec;
  form: UnitForm;
  document: DesignDocumentInput;
  disabled: boolean;
  onName?: (name: string) => void;
}) {
  const path = `fields.${spec.name}.value`;
  const invalid = Boolean(form.errors[path]);
  const label = labelOf(kind, spec);
  const { fields } = form.values;
  const common = { 'aria-label': label, error: invalid, disabled };
  switch (spec.name) {
    case 'name':
      return (
        <TextInput
          {...common}
          data-autofocus
          value={fields.name!.value}
          onChange={(event) => {
            form.setFieldValue(path, event.currentTarget.value);
            onName?.(event.currentTarget.value);
          }}
        />
      );
    case 'stakeholder':
      return <TextInput {...common} {...valueProps(form, path)} />;
    case 'description':
      // A rule's or a scenario's description is markdown.
      if (kind === 'rule' || kind === 'scenario')
        return (
          <MarkdownEditor
            markdown={fields.description!.value}
            headingLevel={3}
            blockTypes={false}
            onChange={(markdown) => form.setFieldValue(path, markdown)}
          />
        );
      return (
        <Textarea
          {...common}
          autosize
          minRows={2}
          {...valueProps(form, path)}
        />
      );
    case 'statement':
    case 'rationale':
      return (
        <Textarea
          {...common}
          autosize
          minRows={1}
          {...valueProps(form, path)}
        />
      );
    case 'definition':
      return (
        <MarkdownEditor
          markdown={fields.definition!.value}
          headingLevel={3}
          blockTypes={false}
          onChange={(markdown) => form.setFieldValue(path, markdown)}
        />
      );
    case 'diagram':
      return <DiagramInput form={form} invalid={invalid} />;
    case 'type': {
      const options = (TYPES_OF[kind] ?? []).map((type) => ({
        value: type,
        label: titleCase(type).replaceAll('_', ' '),
      }));
      // A behavior's three kinds read at a glance as chips; a building
      // block's eight patterns need a list.
      return kind === 'behavior' ? (
        <ChipChoice
          label={label}
          options={options}
          value={fields.type!.value}
          onChange={(type) => form.setFieldValue(path, type)}
        />
      ) : (
        <Select
          {...common}
          placeholder="Choose a type"
          allowDeselect={false}
          data={options}
          value={fields.type!.value || null}
          onChange={(type) => form.setFieldValue(path, type ?? '')}
        />
      );
    }
    case 'kind':
      return (
        <Select
          {...common}
          placeholder="Choose a kind"
          allowDeselect={false}
          data={RULE_KINDS.map((kind) => ({
            value: kind,
            label: ruleKindLabelOf(kind) ?? kind,
          }))}
          value={fields.kind!.value || null}
          onChange={(kind) => form.setFieldValue(path, kind ?? '')}
        />
      );
    case 'needs': {
      const needs = writtenIn(doc.needs);
      if (needs.length === 0)
        return (
          <Text size="sm" c="dimmed">
            This design states no needs, so the rule is a decision of its own.
          </Text>
        );
      return (
        <Chip.Group
          multiple
          value={fields.needs!.value}
          onChange={(chosen) => form.setFieldValue(path, chosen)}
        >
          {/* None chosen: the rule is a decision of the design's own. */}
          <Group
            component="fieldset"
            aria-label={label}
            gap="xs"
            m={0}
            p={0}
            bd="none"
          >
            {needs.map((need) => (
              <Chip key={need.id} value={need.id} variant="outline">
                {valueOf(need.name) ?? need.id}
              </Chip>
            ))}
          </Group>
        </Chip.Group>
      );
    }
    case 'ref':
      return (
        <RefInput
          {...common}
          value={fields.ref!.value}
          blocksOnly={kind === 'extends' || kind === 'collaborator'}
          document={doc}
          onChange={(ref) => form.setFieldValue(path, ref)}
        />
      );
    case 'steps':
      return <ScenarioStepsInput form={form} headed={false} />;
    case 'cardinality':
      return (
        <Select
          {...common}
          allowDeselect={false}
          data={CARDINALITIES.map((cardinality) => ({
            value: cardinality,
            label: CARDINALITY_LABEL[cardinality],
          }))}
          value={fields.cardinality!.value || null}
          onChange={(cardinality) =>
            form.setFieldValue(path, cardinality ?? '')
          }
        />
      );
  }
}

/** How many a slot holds, in words beside the cardinality. */
const CARDINALITY_LABEL: Record<(typeof CARDINALITIES)[number], string> = {
  '1': '1 — exactly one',
  '0..1': '0..1 — one or none',
  '0..*': '0..* — any number',
  '1..*': '1..* — at least one',
};

/**
 * A type: a primitive or a building block the design names. Blocks only the
 * scanned model knows are not offered.
 */
function RefInput({
  value,
  onChange,
  blocksOnly,
  document: doc,
  ...common
}: {
  value: string;
  onChange: (ref: string) => void;
  blocksOnly: boolean;
  document: DesignDocumentInput;
  'aria-label': string;
  error: boolean;
  disabled: boolean;
}) {
  const item = value;
  const blocks = blocksNamedIn(doc);
  const current = item !== '' ? [item] : [];
  const blockIds = [...new Set([...blocks, ...current])].filter((id) =>
    id.startsWith('building_block|'),
  );
  const data = [
    ...(blocksOnly
      ? []
      : [
          {
            group: 'Primitives',
            items: PRIMITIVES.map((id) => ({ value: id, label: nameOf(id) })),
          },
        ]),
    {
      group: 'Building blocks in this design',
      items: blockIds.map((id) => ({ value: id, label: addressOf(id) })),
    },
  ];
  return (
    <Select
      {...common}
      searchable
      placeholder="Choose a type"
      nothingFoundMessage="No such type in this design"
      allowDeselect={false}
      data={data}
      value={item !== '' ? item : null}
      onChange={(next) => onChange(next ?? '')}
    />
  );
}

/** The source as it is typed, and the picture it draws once the typing stops. */
function DiagramInput({ form, invalid }: { form: UnitForm; invalid: boolean }) {
  const source = form.values.fields.diagram!.value;
  const [drawn] = useDebouncedValue(source.trim(), 500);
  return (
    <Stack gap="xs">
      <Textarea
        aria-label="Diagram"
        description="Mermaid source, without the fence. Leave it empty for no diagram."
        placeholder={'flowchart TD\n  A --> B'}
        autosize
        minRows={3}
        error={invalid}
        styles={{
          input: { fontFamily: 'var(--mantine-font-family-monospace)' },
        }}
        {...valueProps(form, 'fields.diagram.value')}
      />
      {drawn !== '' && <MermaidDiagram chart={drawn} />}
    </Stack>
  );
}

/** One of a few, each a chip: picking one sets it, as a radio would. */
function ChipChoice({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: { value: string; label: string }[];
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <Chip.Group value={value} onChange={onChange}>
      <Group gap="xs" role="radiogroup" aria-label={label}>
        {options.map((option) => (
          <Chip key={option.value} value={option.value} variant="outline">
            {option.label}
          </Chip>
        ))}
      </Group>
    </Chip.Group>
  );
}

const valueProps = (form: UnitForm, path: string) => ({
  value: form.getInputProps(path).value as string,
  onChange: (event: { currentTarget: { value: string } }) =>
    form.setFieldValue(path, event.currentTarget.value),
});
