import { IconAlertCircle } from '@tabler/icons-react';
import { Box } from '#/shared/design-system/box.tsx';
import { Group } from '#/shared/design-system/group.tsx';
import { Text } from '#/shared/design-system/text.tsx';
import { Title } from '#/shared/design-system/title.tsx';
import type { DesignedRuleInput } from '#backend/app/design-docs/design-doc.ts';
import { valueOf } from '../../design-doc-field.ts';
import type { TracedRule } from '../../design-doc-requirements.ts';
import { ScenarioColumn } from '../element-details/body/scenario-column.tsx';
import { scenarioEntriesOf } from '../element-details/body/scenarios-of.ts';
import { ChangeBadge } from '../element-details/change-badge.tsx';
import { entryMark } from './entry-mark.ts';
import {
  Details,
  ElementLink,
  type ElementLinkProps,
  RuleField,
  RuleFields,
} from './rule-details.tsx';
import { Remark, Statement } from './statement.tsx';
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
  const mark = entryMark(path, selected);
  if (traced.change === 'removed')
    return (
      <Box className={classes.rule} py="md" {...mark}>
        <RuleHead name={traced.name} change="removed" />
        <RuleFields>
          <RuleField name="Subsystem">{traced.module.name}</RuleField>
          <RuleField name="Element">{element}</RuleField>
        </RuleFields>
      </Box>
    );

  const { rule, change } = traced;
  const statement = valueOf(rule.description);
  return (
    <Box className={classes.rule} py="md" {...mark}>
      <RuleHead name={traced.name} change={change} />
      {statement !== null && <Statement>{statement}</Statement>}
      <Details traced={traced} rule={rule} element={element} />
      <Verification rule={rule} change={change} />
    </Box>
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
    <Group gap="xs" align="baseline">
      <Title
        order={3}
        size="h5"
        className={classes.ruleName}
        data-removed={change === 'removed' || undefined}
      >
        {name}
      </Title>
      <ChangeBadge change={change} />
    </Group>
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
      <Text
        mt="xs"
        py="xs"
        px="sm"
        fz="sm"
        fw={600}
        c="var(--noesis-requirement-gap)"
        className={classes.unverified}
      >
        <IconAlertCircle size={16} aria-hidden />
        No scenario verifies this rule
      </Text>
    ) : (
      <Remark>Scenarios unchanged</Remark>
    );
  return (
    <Box className={classes.verification} mt="xs">
      <ScenarioColumn scenarios={scenarios} defaultOpen headingOrder={4} />
    </Box>
  );
}
