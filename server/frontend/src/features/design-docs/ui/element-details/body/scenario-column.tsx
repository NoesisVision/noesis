import {
  IconChevronRight,
  IconListCheck,
  IconScale,
} from '@tabler/icons-react';
import { useState } from 'react';
import { Accordion } from '#/shared/design-system/accordion.tsx';
import { Button } from '#/shared/design-system/button.tsx';
import { Text } from '#/shared/design-system/text.tsx';
import type { DesignedScenarioInput } from '#backend/app/design-docs/design-doc.ts';
import { valueOf } from '../../../design-doc-field.ts';
import { ChangeBadge } from '../change-badge.tsx';
import type { ScenarioEntry } from './scenarios-of.ts';
import { ScenarioSteps } from './sections/scenario-steps-section.tsx';
import classes from './scenario-column.module.css';

/** Where a rule's count of scenarios points. One panel shows at a time. */
export const SCENARIO_COLUMN_ID = 'element-scenarios';

/**
 * An element's scenarios, in a column of their own beside its sections: each
 * one folded to its name — under it, quietly, the rule it verifies — and
 * opened to what it says.
 */
export function ScenarioColumn({ scenarios }: { scenarios: ScenarioEntry[] }) {
  // The value goes into the ids Mantine writes, which take no spaces.
  const values = scenarios.map((_, index) => String(index));
  const [open, setOpen] = useState<string[]>([]);
  const allOpen = open.length === scenarios.length;
  return (
    <section id={SCENARIO_COLUMN_ID} className={classes.column}>
      <div className={classes.head}>
        <span className={classes.title}>
          <IconListCheck size={16} aria-hidden />
          Scenarios
        </span>
        <Button
          variant="subtle"
          size="xs"
          onClick={() => setOpen(allOpen ? [] : values)}
        >
          {allOpen ? 'Collapse all' : 'Expand all'}
        </Button>
      </div>
      <Accordion
        multiple
        value={open}
        onChange={setOpen}
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
    </section>
  );
}

function ScenarioBody({ scenario }: { scenario: DesignedScenarioInput }) {
  const description = valueOf(scenario.description)?.trim();
  // The control above already names it; a description that only repeats the
  // name says nothing more.
  const says = description && description !== scenario.name.trim();
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
