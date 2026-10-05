import { IconAlertCircle } from '@tabler/icons-react';
import { Text } from '#/shared/design-system/text.tsx';
import { Title } from '#/shared/design-system/title.tsx';
import type { DesignedRuleInput } from '#backend/app/design-docs/design-doc.ts';
import { valueOf } from '../../design-doc-field.ts';
import type { TracedRule } from '../../design-doc-requirements.ts';
import { ScenarioColumn } from '../element-details/body/scenario-column.tsx';
import { scenarioEntriesOf } from '../element-details/body/scenarios-of.ts';
import { ChangeBadge } from '../element-details/change-badge.tsx';
import { FieldList } from '../field-list.tsx';
import {
  Details,
  ElementLink,
  type ElementLinkProps,
} from './rule-details.tsx';
import classes from './requirements-view.module.css';

/** One rule as a requirement: what it says, where it lives, and what verifies it. */
export function RuleEntry({
  path,
  selected,
  traced,
  changeId,
  docId,
}: ElementLinkProps & { path: string; selected: boolean }) {
  const element = (
    <ElementLink traced={traced} changeId={changeId} docId={docId} />
  );
  const mark = {
    'data-entry': path,
    'data-selected': selected || undefined,
  };
  if (traced.change === 'removed')
    return (
      <div className={classes.rule} {...mark}>
        <RuleHead name={traced.name} change="removed" />
        <FieldList className={classes.fields}>
          <dt>Subsystem</dt>
          <dd>{traced.module.name}</dd>
          <dt>Element</dt>
          <dd>{element}</dd>
        </FieldList>
      </div>
    );

  const { rule, change } = traced;
  const statement = valueOf(rule.description);
  return (
    <div className={classes.rule} {...mark}>
      <RuleHead name={traced.name} change={change} />
      {statement !== null && (
        <blockquote className={classes.quote}>{statement}</blockquote>
      )}
      <Details traced={traced} rule={rule} element={element} />
      <Verification rule={rule} change={change} />
    </div>
  );
}

function RuleHead({
  name,
  change,
}: {
  name: string;
  change: TracedRule['change'];
}) {
  return (
    <div className={classes.ruleHead}>
      <Title
        order={3}
        size="h5"
        className={classes.ruleName}
        data-removed={change === 'removed' || undefined}
      >
        {name}
      </Title>
      <ChangeBadge change={change} />
    </div>
  );
}

/**
 * The rule's own scenarios, drawn as the model draws them and open on what
 * each says. An added rule without one says so — what nothing checks is a gap
 * a reviewer must see. A modified rule that leaves its scenarios alone keeps
 * the model's.
 */
function Verification({
  rule,
  change,
}: {
  rule: DesignedRuleInput;
  change: 'added' | 'modified';
}) {
  const scenarios = scenarioEntriesOf(rule.scenarios);
  if (scenarios.length === 0)
    return change === 'added' ? (
      <p className={classes.unverified}>
        <IconAlertCircle size={16} aria-hidden />
        No scenario verifies this rule
      </p>
    ) : (
      <Text className={classes.note}>Scenarios unchanged</Text>
    );
  return (
    <div className={classes.verification}>
      <ScenarioColumn scenarios={scenarios} defaultOpen headingOrder={4} />
    </div>
  );
}
