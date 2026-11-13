import { type ReactNode, useContext, useState } from 'react';
import { Popover } from '#/shared/design-system/popover.tsx';
import { UnstyledButton } from '#/shared/design-system/unstyled-button.tsx';
import { VisuallyHidden } from '#/shared/design-system/visually-hidden.tsx';
import type { Badge, WalkStep } from '../../system-model-exploration.ts';
import { badgeLabelOf, badgeRowsOf, badgeTipOf } from './badge-rows.ts';
import { ExplorationReadingContext } from './exploration-reading.ts';
import { SlotExplorer } from './slot-explorer.tsx';
import { useThemedSurface } from './themes/diagram-theme-context.ts';
import classes from './slot-badges.module.css';

/*
 * A card's slots, drawn on it: under its name, a row for each relation it
 * has slots of — its inputs, its output, its state — each slot a badge in
 * the relation's colour (relationEdges in theme.ts), saying the slot as it
 * is written. A badge whose type is still on the diagram is marked so; one
 * whose type is in hand is drawn as related to it. A badge typed by a block
 * is a button that opens the walk through what that type relates to (see
 * `SlotExplorer`); one typed by a primitive leads nowhere and is words.
 * They sit beside the card's own button, over it, never inside it: a
 * button holds no other.
 */
export function SlotBadges({
  badges,
  frame,
}: {
  badges: readonly Badge[];
  /** Under a frame's name, rather than a card's name and what it is. */
  frame: boolean;
}) {
  const { selected, elements } = useContext(ExplorationReadingContext);
  if (badges.length === 0) return null;
  return (
    <div className={classes.badges} data-part="badges" data-frame={frame}>
      {badgeRowsOf(badges).map(({ relation, badges: row }) => (
        <div key={relation} className={classes.row}>
          <span className={classes.label} aria-hidden>
            {relation}
          </span>
          <ul className={classes.list} aria-label={relation}>
            {row.map((badge) => {
              const shared = {
                className: classes.badge,
                'data-relation': relation,
                'data-related': selected.has(badge.type) || undefined,
                // Said by the canvas's one tooltip, as a card's controls are.
                'data-tip': badgeTipOf(badge),
              };
              const words = (
                <>
                  {badgeLabelOf(badge)}
                  {badge.onDiagram && (
                    <>
                      <span className={classes.onDiagram} aria-hidden>
                        ↗
                      </span>
                      <VisuallyHidden>, also on the diagram</VisuallyHidden>
                    </>
                  )}
                </>
              );
              return (
                <li
                  key={`${badge.holder}#${badge.name}`}
                  className={classes.item}
                >
                  {elements.has(badge.type) ? (
                    <Walked badge={badge} {...shared}>
                      {words}
                    </Walked>
                  ) : (
                    <span {...shared}>{words}</span>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </div>
  );
}

/** A badge that opens the walk from its type, starting afresh each time. */
function Walked({
  badge,
  children,
  ...shared
}: {
  badge: Badge;
  children: ReactNode;
  className: string;
  'data-relation': string;
  'data-related': true | undefined;
  'data-tip': string;
}) {
  const { slots, elements } = useContext(ExplorationReadingContext);
  const [path, setPath] = useState<readonly WalkStep[] | null>(null);
  const surface = useThemedSurface('slot-explorer');
  const opened = path !== null;
  return (
    <Popover
      opened={opened}
      onChange={(open) => {
        if (!open) setPath(null);
      }}
      position="bottom-start"
      offset={4}
      shadow="md"
      trapFocus
      returnFocus
      // The canvas stops a mouse press from reaching the page; a pointer's does.
      clickOutsideEvents={['pointerdown']}
    >
      <Popover.Target>
        <UnstyledButton
          {...shared}
          // A press on it is for the badge, not a drag or pan of the canvas.
          className={`nodrag nopan ${shared.className}`}
          aria-haspopup="dialog"
          aria-expanded={opened}
          onClick={() => setPath(opened ? null : [badge])}
        >
          {children}
        </UnstyledButton>
      </Popover.Target>
      <Popover.Dropdown
        p={0}
        aria-label={`What ${badge.typeName} relates to`}
        {...surface}
      >
        {path !== null && (
          <SlotExplorer
            path={path}
            onPath={setPath}
            slots={slots}
            elements={elements}
          />
        )}
      </Popover.Dropdown>
    </Popover>
  );
}
