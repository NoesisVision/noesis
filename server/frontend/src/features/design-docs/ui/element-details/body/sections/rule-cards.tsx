import { IconArrowRight, IconScale } from '@tabler/icons-react';
import { UnstyledButton } from '#/shared/design-system/unstyled-button.tsx';
import { ChangeBadge } from '../../change-badge.tsx';
import { type ChangeListItem, tracedTo } from '../../change-list-items.ts';
import { useElementNavigation } from '../../element-navigation.ts';
import { SCENARIO_COLUMN_ID } from '../scenario-column.tsx';
import { useScenarioFocus } from '../scenario-focus.tsx';
import classes from './rule-cards.module.css';

/**
 * Rules as cards, each read in full: its name — which opens its row — what
 * kind of rule it is, what it says, the needs it answers, and how many
 * scenarios cover it, which points to the column of them and opens those,
 * closing the rest.
 */
export function RuleCards({ items }: { items: ChangeListItem[] }) {
  const { has, select } = useElementNavigation();
  const focus = useScenarioFocus();
  return (
    <ul className={classes.list}>
      {items.map(
        ({
          change,
          label,
          path,
          description,
          scenarios,
          classification,
          needs,
        }) => (
          <li key={`${change}:${label}`} className={classes.card}>
            <span className={classes.mark} aria-hidden="true">
              <IconScale size={18} />
            </span>
            <div className={classes.body}>
              <div className={classes.head}>
                {path !== null && has(path) ? (
                  <UnstyledButton
                    className={classes.title}
                    data-link
                    data-removed={change === 'removed' || undefined}
                    onClick={() => select(path)}
                  >
                    {label}
                  </UnstyledButton>
                ) : (
                  <span
                    className={classes.title}
                    data-removed={change === 'removed' || undefined}
                  >
                    {label}
                  </span>
                )}
                <ChangeBadge change={change} />
              </div>
              {classification !== undefined && (
                <span className={classes.classification}>{classification}</span>
              )}
              {description !== undefined && (
                <span className={classes.description}>{description}</span>
              )}
              {needs !== undefined && (
                <span className={classes.needs}>{tracedTo(needs)}</span>
              )}
              {scenarios !== undefined && (
                <a
                  href={`#${SCENARIO_COLUMN_ID}`}
                  className={classes.scenarios}
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
                  {scenarios === 1 ? '1 scenario' : `${scenarios} scenarios`}
                  <IconArrowRight size={12} aria-hidden />
                </a>
              )}
            </div>
          </li>
        ),
      )}
    </ul>
  );
}
