import { IconAlertCircle } from '@tabler/icons-react';
import { Fragment, type ReactNode } from 'react';
import { Box } from '#/shared/design-system/box.tsx';
import { Button } from '#/shared/design-system/button.tsx';
import { Group } from '#/shared/design-system/group.tsx';
import { Text } from '#/shared/design-system/text.tsx';
import { Title } from '#/shared/design-system/title.tsx';
import type { DesignedRuleInput } from '#backend/app/design-docs/design-doc.ts';
import type { ElementKind } from '../../design-doc-edit.ts';
import { valueOf } from '../../design-doc-field.ts';
import {
  changesDetails,
  type TracedRule,
} from '../../design-doc-requirements.ts';
import { ruleParts } from '../../rule-sections.ts';
import { ScenarioColumn } from '../element-details/body/scenario-column.tsx';
import { scenarioEntriesOf } from '../element-details/body/scenarios-of.ts';
import { ChangeBadge } from '../element-details/change-badge.tsx';
import { MarkdownReading } from '../element-details/markdown-reading.tsx';
import { useNewScenarioOwner } from '../unit-editor/new-buttons.tsx';
import { useUnitEditing } from '../unit-editor/unit-editing.ts';
import { entryMark } from './entry-mark.ts';
import {
  ElementLink,
  type ElementLinkProps,
  RuleField,
  RuleFields,
} from './rule-details.tsx';
import classes from './requirements-view.module.css';

/**
 * One rule as a requirement, on a card: its name and where it lives, what it
 * says — part by part where it is written so — and, at its foot, what
 * verifies it.
 */
export function RuleEntry({
  path,
  selected,
  traced,
  changeId,
  docId,
}: ElementLinkProps & {
  path: string;
  selected: boolean;
}) {
  const element = (
    <ElementLink traced={traced} changeId={changeId} docId={docId} />
  );
  const mark = entryMark(path, selected);
  if (traced.change === 'removed')
    return (
      <Box component="article" className={classes.rule} {...mark}>
        <RuleHead name={traced.name} change="removed" />
        <RuleFields>
          <RuleField name="Module">{traced.module.name}</RuleField>
          <RuleField name="Element">{element}</RuleField>
        </RuleFields>
      </Box>
    );

  const { rule, change } = traced;
  return (
    <Box component="article" className={classes.rule} {...mark}>
      <RuleHead
        name={traced.name}
        change={change}
        location={
          <Location
            traced={traced}
            element={
              <ElementLink
                traced={traced}
                changeId={changeId}
                docId={docId}
                bare
              />
            }
          />
        }
      />
      <RuleBody rule={rule} />
      <Verification traced={traced} rule={rule} change={change} />
    </Box>
  );
}

function RuleHead({
  name,
  change,
  location,
}: {
  name: string;
  change: TracedRule['change'];
  location?: ReactNode;
}) {
  return (
    <Box component="header" className={classes.ruleHead}>
      <Group gap={10} className={classes.entryTitle}>
        <Title
          order={3}
          className={classes.ruleName}
          data-removed={change === 'removed' || undefined}
        >
          {name}
        </Title>
        <ChangeBadge change={change} size="sm" />
      </Group>
      {location}
    </Box>
  );
}

/**
 * Where a rule lives, under its name: its kind, then its module and the
 * element it is on, which opens in the model. A modified rule that rewrites
 * its kind or its reason says so here.
 */
export function Location({
  traced,
  element,
}: {
  traced: Extract<TracedRule, { change: 'added' | 'modified' }>;
  element: ReactNode;
}) {
  const category = valueOf(traced.rule.category);
  return (
    <Text className={classes.location}>
      {category !== null && `${category} · `}
      {traced.module.name} › {element}
      {changesDetails(traced) && (
        <ChangeBadge change="modified" inline>
          changed
        </ChangeBadge>
      )}
    </Text>
  );
}

/**
 * What the rule says: by its parts, each named in a column of its own, where
 * its description is written in them — an algorithm's steps numbered — and
 * otherwise as it is written. Its rationale, where it gives one, last.
 */
export function RuleBody({ rule }: { rule: DesignedRuleInput }) {
  const description = valueOf(rule.description)?.trim() ?? '';
  const rationale = valueOf(rule.rationale);
  const parts = ruleParts(description);
  const kind = [valueOf(rule.ruleType)].filter((word) => word !== null);
  if (description === '' && rationale === null && kind.length === 0)
    return null;
  return (
    <Box component="dl" className={classes.parts}>
      {parts !== null ? (
        parts.map((part) => (
          <Fragment key={part.name}>
            <dt>{part.name}</dt>
            <dd>
              {part.steps === null ? (
                <MarkdownReading markdown={part.text} />
              ) : (
                <ol className={classes.steps}>
                  {part.steps.map((step) => (
                    <li key={step}>
                      <MarkdownReading markdown={step} />
                    </li>
                  ))}
                </ol>
              )}
            </dd>
          </Fragment>
        ))
      ) : description !== '' ? (
        <>
          <dt>Rule</dt>
          <dd>
            <MarkdownReading markdown={description} />
          </dd>
        </>
      ) : null}
      {kind.length > 0 && (
        <>
          <dt>Type</dt>
          <dd>{kind.join(' · ')}</dd>
        </>
      )}
      {rationale !== null && (
        <>
          <dt>Rationale</dt>
          <dd>{rationale}</dd>
        </>
      )}
    </Box>
  );
}

/**
 * At the card's foot, what verifies the rule: its own scenarios, drawn as the
 * model draws them and open on what each says. An added rule without one
 * says so on a red band — what nothing checks is a gap a reviewer must see.
 * A modified rule that leaves its scenarios alone keeps the model's.
 */
function Verification({
  traced,
  rule,
  change,
}: {
  traced: TracedRule;
  rule: DesignedRuleInput;
  change: 'added' | 'modified';
}) {
  const scenarios = scenarioEntriesOf(rule.scenarios);
  if (scenarios.length === 0)
    return change === 'added' ? (
      <Box className={classes.unverified}>
        <Box component="span" className={classes.unverifiedText}>
          <IconAlertCircle size={16} aria-hidden />
          No scenario verifies this rule
        </Box>
        <AddScenario traced={traced} />
      </Box>
    ) : (
      <Box className={classes.footNote}>Scenarios unchanged</Box>
    );
  return (
    <Box className={classes.verification}>
      <ScenarioColumn scenarios={scenarios} defaultOpen headingOrder={4} />
    </Box>
  );
}

/**
 * Opens the form on a new scenario for the rule, on the element it is on —
 * the one gap a rule's card names, closed from where it is named. Nothing
 * where the design may not be written.
 */
function AddScenario({ traced }: { traced: TracedRule }) {
  const editing = useUnitEditing();
  const { kind, id } = traced.element;
  const preset = useNewScenarioOwner(
    isElementKind(kind) ? { kind, id, rule: traced.name } : undefined,
  );
  if (editing === null || preset === null) return null;
  return (
    <Button
      variant="default"
      size="xs"
      aria-label={`Add a scenario for the rule ${traced.name}`}
      onClick={() =>
        editing.write({ mode: 'add', kind: 'scenario', owner: preset })
      }
    >
      Add scenario
    </Button>
  );
}

const isElementKind = (kind: string): kind is ElementKind =>
  kind === 'module' || kind === 'building_block' || kind === 'behavior';
