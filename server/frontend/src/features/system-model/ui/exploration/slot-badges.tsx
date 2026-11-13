import { VisuallyHidden } from '#/shared/design-system/visually-hidden.tsx';
import type { Badge } from '../../system-model-exploration.ts';
import { badgeLabelOf, badgeRowsOf, badgeTipOf } from './badge-rows.ts';
import classes from './slot-badges.module.css';

/*
 * A card's slots, drawn on it: under its name, a row for each relation it
 * has slots of — its inputs, its output, its state — each slot a badge in
 * the relation's colour (relationEdges in theme.ts), saying the slot as it
 * is written. A badge whose type is still on the diagram is marked so; one
 * whose type is in hand is drawn as related to it. They sit beside the
 * card's own button, over it, never inside it: a button holds no other.
 */
export function SlotBadges({
  badges,
  frame,
  selected,
}: {
  badges: readonly Badge[];
  /** Under a frame's name, rather than a card's name and what it is. */
  frame: boolean;
  /** What is in hand, so a badge of its type reads as related to it. */
  selected: ReadonlySet<string>;
}) {
  if (badges.length === 0) return null;
  return (
    <div className={classes.badges} data-part="badges" data-frame={frame}>
      {badgeRowsOf(badges).map(({ relation, badges: row }) => (
        <div key={relation} className={classes.row}>
          <span className={classes.label} aria-hidden>
            {relation}
          </span>
          <ul className={classes.list} aria-label={relation}>
            {row.map((badge) => (
              <li
                key={`${badge.holder}#${badge.name}`}
                className={classes.badge}
                data-relation={relation}
                data-related={selected.has(badge.type) || undefined}
                // Said by the canvas's one tooltip, as a card's controls are.
                data-tip={badgeTipOf(badge)}
              >
                {badgeLabelOf(badge)}
                {badge.onDiagram && (
                  <>
                    <span className={classes.onDiagram} aria-hidden>
                      ↗
                    </span>
                    <VisuallyHidden>, also on the diagram</VisuallyHidden>
                  </>
                )}
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}
