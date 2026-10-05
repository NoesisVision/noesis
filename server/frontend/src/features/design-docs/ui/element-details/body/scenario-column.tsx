import {
  IconChevronRight,
  IconListCheck,
  IconScale,
} from '@tabler/icons-react';
import { useState } from 'react';
import { Accordion } from '#/shared/design-system/accordion.tsx';
import { Box } from '#/shared/design-system/box.tsx';
import { Button } from '#/shared/design-system/button.tsx';
import { Group } from '#/shared/design-system/group.tsx';
import { Text } from '#/shared/design-system/text.tsx';
import { Title } from '#/shared/design-system/title.tsx';
import type { DesignedScenarioInput } from '#backend/app/design-docs/design-doc.ts';
import type { PartOwner } from '../../../design-doc-edit.ts';
import { valueOf } from '../../../design-doc-field.ts';
import { UnitActions } from '../../unit-editor/unit-actions.tsx';
import { ChangeBadge } from '../change-badge.tsx';
import { SCENARIO_TRANSITION, useScenarioFocus } from './scenario-focus.tsx';
import type { ScenarioEntry } from './scenarios-of.ts';
import { ScenarioSteps } from './sections/scenario-steps-section.tsx';
import classes from './scenario-column.module.css';

/** Where a rule's count of scenarios points. One panel shows at a time. */
export const SCENARIO_COLUMN_ID = 'element-scenarios';

/**
 * An element's scenarios, in a column of their own beside its sections: each
 * one folded to its name — under it, quietly, the rule it verifies — and
 * opened to what it says. Which are open is the panel's, so that a rule
 * can open its own.
 *
 * The requirements view draws a rule's scenarios with it too, where many sit
 * on one page and no panel holds them: there it keeps which are open itself,
 * takes no id, opens on what each scenario says, and heads the list at the
 * level the page has reached.
 */
export function ScenarioColumn({
  scenarios,
  id,
  defaultOpen = false,
  headingOrder,
  owner,
}: {
  scenarios: ScenarioEntry[];
  /** What a link to the column points at; only one on a page may have it. */
  id?: string;
  /** Every scenario open to begin with, rather than folded to its name. */
  defaultOpen?: boolean;
  /** The title as a heading of this level; a plain label when not given. */
  headingOrder?: 3 | 4 | 5 | 6;
  /** The element the scenarios are written in; none where they are only read. */
  owner?: PartOwner;
}) {
  // The value goes into the ids Mantine writes, which take no spaces.
  const values = scenarios.map((_, index) => String(index));
  const focus = useScenarioFocus();
  const [own, setOwn] = useState<string[]>(defaultOpen ? values : []);
  const { open, setOpen } = focus ?? { open: own, setOpen: setOwn };
  const allOpen = open.length === scenarios.length;
  const heading = (
    <>
      <IconListCheck size={16} aria-hidden />
      Scenarios
    </>
  );
  return (
    <Box component="section" id={id} className={classes.column}>
      <Group justify="space-between" gap="xs" px="sm" wrap="nowrap">
        {headingOrder === undefined ? (
          <Text span className={classes.title}>
            {heading}
          </Text>
        ) : (
          <Title order={headingOrder} className={classes.title}>
            {heading}
          </Title>
        )}
        <Button
          variant="subtle"
          size="xs"
          onClick={() => setOpen(allOpen ? [] : values)}
        >
          {allOpen ? 'Collapse all' : 'Expand all'}
        </Button>
      </Group>
      <Accordion
        multiple
        value={open}
        onChange={setOpen}
        transitionDuration={SCENARIO_TRANSITION}
        chevronPosition="left"
        chevron={<IconChevronRight size={16} />}
        classNames={{
          item: classes.item,
          control: classes.control,
          chevron: classes.chevron,
          label: classes.label,
          content: classes.panel,
        }}
      >
        {scenarios.map((entry, index) => (
          <Accordion.Item
            key={`${entry.rule ?? ''}:${entry.change}:${entry.name}`}
            value={values[index]!}
            // What a rule's count looks for to bring it into view.
            data-scenario={values[index]}
          >
            <Accordion.Control>
              <IconListCheck size={16} className={classes.dim} aria-hidden />
              <span className={classes.text}>
                <span
                  className={classes.name}
                  data-removed={entry.change === 'removed' || undefined}
                >
                  {entry.name}
                </span>
                {entry.rule !== undefined && (
                  <span className={classes.rule}>
                    <IconScale size={12} aria-hidden />
                    <span className={classes.ellipsis}>{entry.rule}</span>
                  </span>
                )}
              </span>
              <ChangeBadge change={entry.change} inline />
            </Accordion.Control>
            <Accordion.Panel>
              {owner !== undefined && (
                <Group justify="flex-end">
                  <UnitActions
                    unit={{
                      kind: 'scenario',
                      id: entry.name,
                      owner:
                        entry.rule === undefined
                          ? owner
                          : { ...owner, rule: entry.rule },
                    }}
                  />
                </Group>
              )}
              {entry.scenario === null ? (
                <Text c="dimmed" size="sm">
                  This design removes it.
                </Text>
              ) : (
                <ScenarioBody scenario={entry.scenario} />
              )}
            </Accordion.Panel>
          </Accordion.Item>
        ))}
      </Accordion>
    </Box>
  );
}

/** A sentence as it reads, whatever its case, spacing and closing punctuation. */
const plain = (text: string) =>
  text
    .trim()
    .replace(/[.!?…:;]+$/, '')
    .replace(/\s+/g, ' ')
    .toLowerCase();

function ScenarioBody({ scenario }: { scenario: DesignedScenarioInput }) {
  const description = valueOf(scenario.description)?.trim();
  // The control above already names it; a description that only repeats the
  // name — give or take its case, spacing or a full stop — says nothing more.
  const says = description && plain(description) !== plain(scenario.name);
  return (
    <>
      {says && (
        <Text size="sm" c="dimmed" mb="xs">
          {description}
        </Text>
      )}
      <ScenarioSteps scenario={scenario} />
    </>
  );
}
