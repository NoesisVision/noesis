import {
  IconBolt,
  IconCheck,
  IconChevronDown,
  IconCircleCheck,
  IconFlag,
  IconPlus,
  IconX,
} from '@tabler/icons-react';
import { type ReactNode, useId, useRef, useState } from 'react';
import { ActionIcon } from '#/shared/design-system/action-icon.tsx';
import { Badge } from '#/shared/design-system/badge.tsx';
import { Button } from '#/shared/design-system/button.tsx';
import type { UseFormReturnType } from '#/shared/design-system/form.ts';
import { Menu } from '#/shared/design-system/menu.tsx';
import { TextInput } from '#/shared/design-system/text-input.tsx';
import { Text } from '#/shared/design-system/text.tsx';
import { Textarea } from '#/shared/design-system/textarea.tsx';
import { MarkdownEditor } from '#/shared/ui/markdown-editor.tsx';
import type {
  ScenarioStep,
  ScenarioStepKind,
} from '#backend/app/system-model/system-model.ts';
import type { UnitDraft, UnitState } from '../../design-doc-edit.ts';
import {
  keywordOf,
  nextKindAfter,
  STEP_KEYWORD,
  STEP_KINDS,
} from '../../scenario-steps.ts';
import classes from './scenario-fields.module.css';

/** Each kind of step in its own colour, as the timeline draws it. */
const KIND: Record<
  ScenarioStepKind,
  { hint: string; placeholder: string; icon: ReactNode; color: string }
> = {
  given: {
    hint: 'the starting state',
    placeholder: 'A document with no versions',
    icon: <IconFlag size={16} aria-hidden />,
    color: 'teal',
  },
  when: {
    hint: 'the action',
    placeholder: 'The first version is created with two reviewers',
    icon: <IconBolt size={16} aria-hidden />,
    color: 'brand',
  },
  // oxlint-disable-next-line unicorn/no-thenable
  then: {
    hint: 'the outcome',
    placeholder: 'Version 1 exists with the status new',
    icon: <IconCircleCheck size={16} aria-hidden />,
    color: 'violet',
  }, // NOSONAR
};

/**
 * A scenario's fields: its name, the rule it belongs to, an optional
 * description, and its steps as a timeline — as many Givens, Whens and Thens
 * as it takes, at least one — each step's mark filling in once it is written. In a scenario the model has, a field left as the model says it
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
  const field = (name: 'name' | 'description') => {
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
  const steps = form.values.fields.steps ?? { written: true, value: [] };
  const name = field('name');
  const description = field('description');
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
      <ScenarioStepsInput
        form={form}
        placeholderOf={(kind) =>
          unchanged(steps.written, KIND[kind].placeholder)
        }
      />
    </>
  );
}

/**
 * The steps as a timeline, one row a step: its mark opens the kinds to switch
 * it to, its text says it, and it goes with the cross beside it — but the
 * last one stays, as a scenario has at least one step. A step is added at the
 * end, of the kind that most likely comes next, and is ready to be typed.
 * Within a form that labels its fields itself, it goes without its heading.
 */
export function ScenarioStepsInput({
  form,
  placeholderOf = (kind) => KIND[kind].placeholder,
  headed = true,
}: {
  form: UseFormReturnType<UnitDraft>;
  placeholderOf?: (kind: ScenarioStepKind) => string;
  headed?: boolean;
}) {
  const steps = form.values.fields.steps?.value ?? [];
  // Steps have no identity of their own: each row keeps a key while it lives,
  // so removing one leaves the others' text boxes as they were.
  const [keys, setKeys] = useState(() => steps.map((_, index) => index));
  const nextKey = useRef(steps.length);
  const rowKeys = keys.length === steps.length ? keys : steps.map((_, i) => i);
  // The row just added, whose text box takes the focus as it appears.
  const focusKey = useRef<number | null>(null);

  const write = (next: ScenarioStep[]) =>
    form.setFieldValue('fields.steps', { written: true, value: next });
  const change = (index: number, step: Partial<ScenarioStep>) =>
    write(steps.map((each, i) => (i === index ? { ...each, ...step } : each)));
  const remove = (index: number) => {
    setKeys(rowKeys.filter((_, i) => i !== index));
    write(steps.filter((_, i) => i !== index));
  };
  const add = () => {
    const key = nextKey.current++;
    setKeys([...rowKeys, key]);
    focusKey.current = key;
    write([...steps, { kind: nextKindAfter(steps), text: '' }]);
  };

  const filled = steps.filter((step) => step.text.trim() !== '').length;
  const error = form.errors['fields.steps.value'];
  return (
    <div className={classes.steps}>
      {headed && (
        <div className={classes.stepsHead}>
          <Text size="sm" fw={500}>
            Steps
          </Text>
          <Badge
            variant="light"
            size="sm"
            color={
              steps.length > 0 && filled === steps.length ? 'green' : 'gray'
            }
          >
            {`${filled} of ${steps.length} written`}
          </Badge>
        </div>
      )}
      <ol className={classes.timeline}>
        {steps.map((step, index) => {
          const kind = KIND[step.kind];
          const keyword = keywordOf(steps, index);
          const key = rowKeys[index]!;
          const done = step.text.trim() !== '';
          return (
            <li key={key} className={classes.step}>
              <span className={classes.rail}>
                <Menu position="bottom-start" shadow="md" offset={4}>
                  <Menu.Target>
                    <ActionIcon
                      size={30}
                      radius="xl"
                      variant={done ? 'filled' : 'light'}
                      color={kind.color}
                      aria-label={`Step ${index + 1}, ${STEP_KEYWORD[step.kind]}: change its kind`}
                    >
                      {kind.icon}
                    </ActionIcon>
                  </Menu.Target>
                  <Menu.Dropdown>
                    {STEP_KINDS.map((each) => (
                      <Menu.Item
                        key={each}
                        leftSection={KIND[each].icon}
                        rightSection={
                          each === step.kind ? (
                            <IconCheck size={14} aria-hidden />
                          ) : undefined
                        }
                        onClick={() => change(index, { kind: each })}
                      >
                        {STEP_KEYWORD[each]}
                      </Menu.Item>
                    ))}
                  </Menu.Dropdown>
                </Menu>
                {/* The mark opens the kinds: a chevron at its foot says so. */}
                <IconChevronDown
                  size={12}
                  stroke={2.5}
                  className={classes.switchHint}
                  aria-hidden
                />
                <span className={classes.line} aria-hidden="true" />
              </span>
              <div className={classes.stepBody}>
                <div className={classes.stepLabel}>
                  <Text size="sm" fw={600}>
                    {keyword}
                  </Text>
                  {keyword !== 'And' && (
                    <Text size="xs" c="dimmed">
                      {kind.hint}
                    </Text>
                  )}
                  <ActionIcon
                    variant="subtle"
                    color="gray"
                    size="sm"
                    ml="auto"
                    disabled={steps.length === 1}
                    aria-label={`Remove step ${index + 1}`}
                    onClick={() => remove(index)}
                  >
                    <IconX size={14} aria-hidden />
                  </ActionIcon>
                </div>
                <Textarea
                  ref={(element) => {
                    if (element === null || focusKey.current !== key) return;
                    focusKey.current = null;
                    element.focus();
                  }}
                  aria-label={`Step ${index + 1}, ${keyword}`}
                  placeholder={placeholderOf(step.kind)}
                  autosize
                  minRows={1}
                  maxRows={4}
                  value={step.text}
                  error={form.errors[`fields.steps.value.${index}.text`]}
                  onChange={(event) =>
                    change(index, { text: event.currentTarget.value })
                  }
                />
              </div>
            </li>
          );
        })}
      </ol>
      <div>
        <Button
          variant="light"
          size="xs"
          leftSection={<IconPlus size={14} aria-hidden />}
          onClick={add}
        >
          Add step
        </Button>
      </div>
      {headed && error !== undefined && (
        <Text size="xs" c="red">
          {error}
        </Text>
      )}
    </div>
  );
}
