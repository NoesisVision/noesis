import { IconArrowRight, IconScale } from '@tabler/icons-react';
import { clsx } from 'clsx';
import { counted } from '#/features/design-docs/ui/plural.ts';
import { Anchor } from '#/shared/design-system/anchor.tsx';
import { Group } from '#/shared/design-system/group.tsx';
import { Text } from '#/shared/design-system/text.tsx';
import { UnstyledButton } from '#/shared/design-system/unstyled-button.tsx';
import type { DesignedRuleInput } from '#backend/app/design-docs/design-doc.ts';
import type {
  RuleCategory,
  RuleType,
} from '#backend/app/system-model/system-model.ts';
import { writtenIn } from '../../../../change-set.ts';
import {
  type PartOwner,
  RULE_TYPES_OF,
  unitOf,
} from '../../../../design-doc-edit.ts';
import { valueOf } from '../../../../design-doc-field.ts';
import { tracedTo } from '../../../../design-doc-requirements.ts';
import { InlineChips } from '../../../unit-editor/inline-chips.tsx';
import { InlineChoice } from '../../../unit-editor/inline-choice.tsx';
import { InlineMarkdown } from '../../../unit-editor/inline-markdown.tsx';
import { InlineText } from '../../../unit-editor/inline-text.tsx';
import { NewScenarioButton } from '../../../unit-editor/new-buttons.tsx';
import { RemoveButton } from '../../../unit-editor/remove-button.tsx';
import { useUnitEditing } from '../../../unit-editor/unit-editing.ts';
import { useWritableUnit } from '../../../unit-editor/writable-unit.ts';
import { ChangeBadge } from '../../change-badge.tsx';
import type { ChangeListItem } from '../../change-list-items.ts';
import { useDesignDocument } from '../../design-document-context.ts';
import { useElementNavigation } from '../../element-navigation.ts';
import { ListTooltip } from '../../element-tooltip.tsx';
import {
  nameFieldsOf,
  writtenByHuman,
  humanText,
  WrittenBy,
} from '../../human-mark.tsx';
import { MarkdownReading } from '../../markdown-reading.tsx';
import { SCENARIO_COLUMN_ID } from '../scenario-column.tsx';
import { useScenarioFocus } from '../scenario-focus.tsx';
import classes from './rule-cards.module.css';

/**
 * Rules as cards, each read in full: its name — which opens its row — what
 * kind of rule it is, what it says, the needs it answers, and how many
 * scenarios cover it, which points to the column of them and opens those,
 * closing the rest. Where the design may be written, its name, kind and
 * description are written in place.
 */
export function RuleCards({
  items,
  owner = null,
}: {
  items: ChangeListItem[];
  /** The element they are written in; none where they are only read. */
  owner?: PartOwner | null;
}) {
  return (
    <ul className={classes.list}>
      {items.map((item) => (
        <RuleCard
          key={`${item.change}:${item.label}`}
          item={item}
          owner={owner}
        />
      ))}
    </ul>
  );
}

function RuleCard({
  item,
  owner,
}: {
  item: ChangeListItem;
  owner: PartOwner | null;
}) {
  const {
    change,
    label,
    path,
    description,
    scenarios,
    scenarioNames,
    classification,
    needs,
  } = item;
  const { has, select } = useElementNavigation();
  const focus = useScenarioFocus();
  const writable = useWritableUnit(
    owner === null ? null : { kind: 'rule', id: label, owner },
  );
  const rule = writable?.unit as DesignedRuleInput | null | undefined;
  const document = useUnitEditing()?.document;
  // The needs of this design a rule may answer, by name.
  const needChoices =
    document === undefined
      ? []
      : writtenIn(document.needs).map((need) => ({
          value: need.id,
          label: valueOf(need.name) ?? need.id,
        }));
  // What the design writes of the rule, for who wrote it — read only or not.
  const doc = useDesignDocument();
  const designed =
    doc === null || owner === null
      ? null
      : (unitOf(doc, {
          kind: 'rule',
          id: label,
          owner,
        }) as DesignedRuleInput | null);
  // What the rule's kind is made of, for who wrote it.
  const kind = [designed?.category, designed?.ruleType];
  // The rule's name is its key, with no writer of its own: marked only where
  // a human made the whole rule.
  const whole = nameFieldsOf(designed);
  const removed = change === 'removed' || undefined;
  return (
    <li className={classes.card}>
      <span className={classes.mark} aria-hidden="true">
        <IconScale size={18} />
      </span>
      <div className={classes.body}>
        <div className={classes.head}>
          {/* The name and its badge together; the buttons keep the end. */}
          <span className={classes.titleLine}>
            {path !== null && has(path) ? (
              <WrittenBy fields={whole}>
                <UnstyledButton
                  className={classes.title}
                  data-link
                  data-removed={removed}
                  onClick={() => select(path)}
                >
                  {label}
                </UnstyledButton>
              </WrittenBy>
            ) : writable !== null && writable.state === 'added' ? (
              // A rule is known by its name: only one the design adds is renamed.
              <InlineText
                label="Name"
                human={writtenByHuman(whole)}
                value={label}
                className={clsx(classes.title, humanText(whole))}
                onSave={(name) => writable.save({ name })}
              />
            ) : (
              <WrittenBy fields={whole}>
                <span className={classes.title} data-removed={removed}>
                  {label}
                </span>
              </WrittenBy>
            )}
            <ChangeBadge change={change} inline />
          </span>
          {owner !== null && (
            <Group gap={2} wrap="nowrap" className={classes.actions}>
              <NewScenarioButton owner={{ ...owner, rule: label }} icon />
              <RemoveButton unit={{ kind: 'rule', id: label, owner }} />
            </Group>
          )}
        </div>
        {writable === null ? (
          classification !== undefined && (
            <WrittenBy fields={kind}>
              <span className={classes.classification}>{classification}</span>
            </WrittenBy>
          )
        ) : (
          <InlineChoice
            label="Rule type"
            human={writtenByHuman(kind)}
            value={valueOf(rule?.ruleType) ?? null}
            data={ruleTypeChoices(owner)}
            className={clsx(classes.classification, humanText(kind))}
            onSave={(ruleType) =>
              writable.save({
                category: categoryOf(ruleType as RuleType),
                ruleType,
              })
            }
          >
            {classification ?? 'Not classified'}
          </InlineChoice>
        )}
        {writable === null ? (
          description !== undefined && (
            <WrittenBy fields={[designed?.description]}>
              <div className={classes.description}>
                <MarkdownReading markdown={description} />
              </div>
            </WrittenBy>
          )
        ) : (
          <div
            className={clsx(
              classes.description,
              humanText([designed?.description]),
            )}
          >
            <InlineMarkdown
              label="Description"
              human={writtenByHuman([designed?.description])}
              value={valueOf(rule?.description) ?? ''}
              onSave={(text) => writable.save({ description: text })}
            >
              {(valueOf(rule?.description) ?? '').trim() === '' ? (
                <Text span size="sm" c="dimmed" fs="italic">
                  No description
                </Text>
              ) : (
                <MarkdownReading markdown={valueOf(rule?.description) ?? ''} />
              )}
            </InlineMarkdown>
          </div>
        )}
        {writable === null || needChoices.length === 0 ? (
          needs !== undefined && (
            <WrittenBy fields={[designed?.needs]}>
              <span className={classes.needs}>{tracedTo(needs)}</span>
            </WrittenBy>
          )
        ) : (
          <InlineChips
            label="Needs it answers"
            human={writtenByHuman([designed?.needs])}
            value={valueOf(rule?.needs) ?? []}
            data={needChoices}
            className={clsx(classes.needs, humanText([designed?.needs]))}
            onSave={(chosen) => writable.save({ needs: chosen })}
          >
            {tracedTo(needs ?? [])}
          </InlineChips>
        )}
        {scenarios !== undefined && (
          // Pointed at, the count names the scenarios it would open.
          <ListTooltip
            title={label}
            label="Scenarios"
            items={scenarioNames ?? []}
          >
            <Anchor
              href={`#${SCENARIO_COLUMN_ID}`}
              underline="never"
              className={classes.scenarios}
              // Its scenarios stand out: the same count again lets go of them.
              data-active={focus?.rule === label || undefined}
              // Straight to the rule's first scenario, not the top of the
              // column; the link alone is for a rule drawn without one.
              onClick={(event) => {
                if (focus === null) return;
                event.preventDefault();
                focus.showRule(label);
              }}
            >
              <span className={classes.dots} aria-hidden="true">
                <span />
                <span />
              </span>
              {counted(scenarios, 'scenario')}
              <IconArrowRight size={12} aria-hidden />
            </Anchor>
          </ListTooltip>
        )}
      </div>
    </li>
  );
}

/** Every rule type by its category; a module holds no business rules. */
const ruleTypeChoices = (owner: PartOwner | null) =>
  (Object.keys(RULE_TYPES_OF) as RuleCategory[])
    .filter((category) => owner?.kind !== 'module' || category !== 'Business')
    .map((category) => ({
      group: category,
      items: [...RULE_TYPES_OF[category]],
    }));

/** The category a rule type belongs to: each type is in exactly one. */
const categoryOf = (ruleType: RuleType): RuleCategory =>
  (Object.keys(RULE_TYPES_OF) as RuleCategory[]).find((category) =>
    RULE_TYPES_OF[category].includes(ruleType),
  )!;
