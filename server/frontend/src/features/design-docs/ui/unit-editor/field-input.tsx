import { Chip } from '#/shared/design-system/chip.tsx';
import { Group } from '#/shared/design-system/group.tsx';
import { Select } from '#/shared/design-system/select.tsx';
import { TextInput } from '#/shared/design-system/text-input.tsx';
import { Text } from '#/shared/design-system/text.tsx';
import { Textarea } from '#/shared/design-system/textarea.tsx';
import { MarkdownEditor } from '#/shared/ui/markdown-editor.tsx';
import { modelWordOf } from '#/shared/ui/title-case.ts';
import type { DesignDocumentInput } from '#backend/app/design-docs/design-doc.ts';
import { CARDINALITIES, cardinalityChoiceOf } from '../../cardinality.ts';
import { writtenIn } from '../../change-set.ts';
import {
  type FieldSpec,
  TYPES_OF,
  type UnitKind,
} from '../../design-doc-edit.ts';
import { valueOf } from '../../design-doc-field.ts';
import { ruleKindLabelOf, RULE_KINDS } from '../../rules.ts';
import { DiagramInput } from './diagram-input.tsx';
import { RefInput } from './ref-input.tsx';
import { ScenarioStepsInput } from './scenario-fields.tsx';
import { labelOf, type UnitForm, valueProps } from './unit-form.ts';

/*
 * One field of a unit's form, drawn as the field it is.
 */

export function FieldInput({
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
      // Only a rule and a scenario have one, in markdown.
      return (
        <MarkdownEditor
          markdown={fields.description!.value}
          headingLevel={3}
          blockTypes={false}
          onChange={(markdown) => form.setFieldValue(path, markdown)}
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
        label: modelWordOf(type),
      }));
      return (
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
          blocksOnly={kind === 'extends'}
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
            label: cardinalityChoiceOf(cardinality),
          }))}
          value={fields.cardinality!.value || null}
          onChange={(cardinality) =>
            form.setFieldValue(path, cardinality ?? '')
          }
        />
      );
  }
}

/** How many a slot holds, as it reads after the type, and in words. */
