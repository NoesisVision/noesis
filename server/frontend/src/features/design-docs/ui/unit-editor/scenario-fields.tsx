import { IconBolt, IconCircleCheck, IconFlag } from '@tabler/icons-react';
import { type ReactNode, useId } from 'react';
import { Badge } from '#/shared/design-system/badge.tsx';
import type { UseFormReturnType } from '#/shared/design-system/form.ts';
import { TextInput } from '#/shared/design-system/text-input.tsx';
import { Text } from '#/shared/design-system/text.tsx';
import { Textarea } from '#/shared/design-system/textarea.tsx';
import { ThemeIcon } from '#/shared/design-system/theme-icon.tsx';
import { MarkdownEditor } from '#/shared/ui/markdown-editor.tsx';
import type { UnitDraft, UnitState } from '../../design-doc-edit.ts';
import classes from './scenario-fields.module.css';

type StepName = 'given' | 'when' | 'then';

/** The three steps, each in its own colour, as the timeline draws them. */
const STEPS: {
  name: StepName;
  label: string;
  hint: string;
  placeholder: string;
  icon: ReactNode;
  color: string;
}[] = [
  {
    name: 'given',
    label: 'Given',
    hint: 'the starting state',
    placeholder: 'A document with no versions',
    icon: <IconFlag size={16} aria-hidden />,
    color: 'teal',
  },
  {
    name: 'when',
    label: 'When',
    hint: 'the action',
    placeholder: 'The first version is created with two reviewers',
    icon: <IconBolt size={16} aria-hidden />,
    color: 'brand',
  },
  {
    name: 'then',
    label: 'Then',
    hint: 'the outcome',
    placeholder: 'Version 1 exists with the status new',
    icon: <IconCircleCheck size={16} aria-hidden />,
    color: 'violet',
  },
];

/**
 * A scenario's fields: its name, the rule it belongs to, an optional description, and its steps as a
 * timeline — Given, When, Then — each step's mark filling in once it is
 * written. In a scenario the model has, a field left as the model says it
 * reads so in its placeholder until it is typed into.
 */
export function ScenarioFields({
  form,
  state,
  nameLocked,
  belongsTo,
}: {
  form: UseFormReturnType<UnitDraft>;
  state: UnitState;
  /** The model knows a scenario it has by its name: only an added one is renamed. */
  nameLocked: boolean;
  /** The rule it belongs to, picked under its name. */
  belongsTo?: ReactNode;
}) {
  const revisable = state !== 'added';
  const id = useId();
  const field = (name: 'name' | 'description' | StepName) => {
    const draft = form.values.fields[name] as
      | { written: boolean; value: string }
      | undefined;
    return {
      value: draft?.value ?? '',
      written: draft?.written ?? true,
      error: form.errors[`fields.${name}.value`],
      onChange: (value: string) =>
        form.setFieldValue(`fields.${name}`, { written: true, value }),
    };
  };
  const unchanged = (written: boolean, placeholder: string) =>
    revisable && !written ? 'Unchanged — type to write' : placeholder;
  const name = field('name');
  const description = field('description');
  const filled = STEPS.filter(
    (step) => field(step.name).value.trim() !== '',
  ).length;
  return (
    <>
      <TextInput
        label="Name"
        withAsterisk
        placeholder="e.g. Creates the first version with its reviewers"
        data-autofocus
        disabled={nameLocked}
        description={
          nameLocked
            ? 'The model knows this scenario by its name, so it keeps it.'
            : undefined
        }
        value={name.value}
        error={name.error}
        onChange={(event) => name.onChange(event.currentTarget.value)}
      />
      {belongsTo}
      {/* Markdown, as a rule's or a scenario's description is read. */}
      <fieldset
        className={classes.description}
        aria-labelledby={`${id}-description`}
      >
        <Text id={`${id}-description`} size="sm" fw={500}>
          Description
        </Text>
        <Text size="xs" c="dimmed" mb={5}>
          {unchanged(
            description.written,
            'Optional context for readers of this scenario, in markdown.',
          )}
        </Text>
        <MarkdownEditor
          markdown={description.value}
          headingLevel={3}
          blockTypes={false}
          onChange={description.onChange}
        />
        {description.error !== undefined && (
          <Text size="xs" c="red" mt={5}>
            {description.error}
          </Text>
        )}
      </fieldset>
      <div className={classes.steps}>
        <div className={classes.stepsHead}>
          <Text size="sm" fw={500}>
            Steps
          </Text>
          <Badge
            variant="light"
            size="sm"
            color={filled === STEPS.length ? 'green' : 'gray'}
          >
            {`${filled} of ${STEPS.length} written`}
          </Badge>
        </div>
        <ol className={classes.timeline}>
          {STEPS.map((step) => {
            const { value, written, error, onChange } = field(step.name);
            const done = value.trim() !== '';
            return (
              <li key={step.name} className={classes.step}>
                <span className={classes.rail} aria-hidden="true">
                  <ThemeIcon
                    size={30}
                    radius="xl"
                    variant={done ? 'filled' : 'light'}
                    color={step.color}
                  >
                    {step.icon}
                  </ThemeIcon>
                  <span className={classes.line} />
                </span>
                <div className={classes.stepBody}>
                  <div className={classes.stepLabel}>
                    <Text size="sm" fw={600}>
                      {step.label}
                    </Text>
                    <Text size="xs" c="dimmed">
                      {step.hint}
                    </Text>
                  </div>
                  <Textarea
                    aria-label={step.label}
                    placeholder={unchanged(written, step.placeholder)}
                    autosize
                    minRows={1}
                    maxRows={4}
                    value={value}
                    error={error}
                    onChange={(event) => onChange(event.currentTarget.value)}
                  />
                </div>
              </li>
            );
          })}
        </ol>
      </div>
    </>
  );
}
