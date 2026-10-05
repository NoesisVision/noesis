import { IconArrowRight, IconScale } from '@tabler/icons-react';
import { counted } from '#/features/design-docs/ui/plural.ts';
import { Anchor } from '#/shared/design-system/anchor.tsx';
import { UnstyledButton } from '#/shared/design-system/unstyled-button.tsx';
import type { PartOwner } from '../../../../design-doc-edit.ts';
import { tracedTo } from '../../../../design-doc-requirements.ts';
import {
  UnitActions,
  UnitContextMenu,
} from '../../../unit-editor/unit-actions.tsx';
import { ChangeBadge } from '../../change-badge.tsx';
import type { ChangeListItem } from '../../change-list-items.ts';
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
export function RuleCards({
  items,
  owner,
}: {
  items: ChangeListItem[];
  /** The element they are written in, which a write from a card names. */
  owner: PartOwner | null;
}) {
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
        }) => {
          const card = (
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
                  {owner !== null && (
                    <span className={classes.actions}>
                      <UnitActions
                        unit={{ kind: 'rule', id: label, owner }}
                        keyboardOnly
                      />
                    </span>
                  )}
                </div>
                {classification !== undefined && (
                  <span className={classes.classification}>
                    {classification}
                  </span>
                )}
                {description !== undefined && (
                  <span className={classes.description}>{description}</span>
                )}
                {needs !== undefined && (
                  <span className={classes.needs}>{tracedTo(needs)}</span>
                )}
                {scenarios !== undefined && (
                  <Anchor
                    href={`#${SCENARIO_COLUMN_ID}`}
                    underline="never"
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
                    {counted(scenarios, 'scenario')}
                    <IconArrowRight size={12} aria-hidden />
                  </Anchor>
                )}
              </div>
            </li>
          );
          return owner === null ? (
            card
          ) : (
            <UnitContextMenu
              key={`${change}:${label}`}
              unit={{ kind: 'rule', id: label, owner }}
            >
              {card}
            </UnitContextMenu>
          );
        },
      )}
    </ul>
  );
}
