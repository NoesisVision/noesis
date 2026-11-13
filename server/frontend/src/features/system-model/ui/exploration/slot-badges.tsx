import { IconChevronDown } from '@tabler/icons-react';
import { type ReactNode, useContext, useState } from 'react';
import {
  CardinalityMark,
  isMarked,
} from '#/features/design-docs/element-reader.ts';
import { Popover } from '#/shared/design-system/popover.tsx';
import { UnstyledButton } from '#/shared/design-system/unstyled-button.tsx';
import { VisuallyHidden } from '#/shared/design-system/visually-hidden.tsx';
import type { Badge, WalkStep } from '../../system-model-exploration.ts';
import { badgeRowsOf, badgeSaidOf, badgeTipOf } from './badge-rows.ts';
import { ExplorationReadingContext } from './exploration-reading.ts';
import { SlotExplorer } from './slot-explorer.tsx';
import {
  recallSlotView,
  rememberSlotView,
  type SlotView,
} from './slot-view.ts';
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
              const opens = elements.has(badge.type);
              const words = (
                <>
                  {/* Its name, quiet, over its type, each a line of its
                      own; read out as the slot is written, `offer: Offer`. */}
                  <span className={classes.name}>{badge.name}</span>
                  <VisuallyHidden>: </VisuallyHidden>
                  <span className={classes.type}>
                    <span className={classes.typeName}>{badge.typeName}</span>
                    {/* After the type, whole however short the type is cut. */}
                    {isMarked(badge.cardinality) && (
                      <CardinalityMark cardinality={badge.cardinality} />
                    )}
                    {badge.onDiagram && (
                      <>
                        <span className={classes.mark} aria-hidden>
                          ↗
                        </span>
                        <VisuallyHidden>, also on the diagram</VisuallyHidden>
                      </>
                    )}
                    {/* A type to walk into says so, faintly. */}
                    {opens && (
                      <IconChevronDown
                        className={classes.mark}
                        size={10}
                        stroke={2.4}
                        aria-hidden
                      />
                    )}
                  </span>
                </>
              );
              return (
                <li
                  key={`${badge.holder}#${badge.name}`}
                  className={classes.item}
                >
                  {opens ? (
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
  const { slots, elements, onGoTo } = useContext(ExplorationReadingContext);
  const [path, setPath] = useState<readonly WalkStep[] | null>(null);
  // How the walk is drawn: as the reader last chose this session.
  const [view, setView] = useState<SlotView>('columns');
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
          // Named as the slot is written: its two lines would be read apart.
          aria-label={`${badgeSaidOf(badge)}${badge.onDiagram ? ', also on the diagram' : ''}`}
          aria-haspopup="dialog"
          aria-expanded={opened}
          onClick={() => {
            if (!opened) setView(recallSlotView());
            setPath(opened ? null : [badge]);
          }}
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
            view={view}
            onView={(next) => {
              setView(next);
              rememberSlotView(next);
            }}
            slots={slots}
            elements={elements}
            onGoTo={
              badge.onDiagram
                ? () => {
                    setPath(null);
                    onGoTo(badge.type);
                  }
                : undefined
            }
          />
        )}
      </Popover.Dropdown>
    </Popover>
  );
}
