import { type ReactNode, useCallback, useContext, useState } from 'react';
import {
  CardinalityMark,
  isMarked,
} from '#/features/design-docs/element-reader.ts';
import { Popover } from '#/shared/design-system/popover.tsx';
import { UnstyledButton } from '#/shared/design-system/unstyled-button.tsx';
import { VisuallyHidden } from '#/shared/design-system/visually-hidden.tsx';
import type { Badge, WalkStep } from '../../system-model-exploration.ts';
import {
  badgeSaidOf,
  badgeTipOf,
  NO_OUTPUT,
  signatureLinesOf,
} from './badge-signature.ts';
import {
  ExplorationReadingContext,
  useSelectedAmong,
} from './exploration-reading.ts';
import { SlotExplorer } from './slot-explorer.tsx';
import {
  recallSlotView,
  rememberSlotView,
  type SlotView,
} from './slot-view.ts';
import { useThemedSurface } from './themes/diagram-theme-context.ts';
import { useLazyOpening } from './use-lazy-opening.ts';
import classes from './slot-badges.module.css';

/*
 * A card's slots, drawn on it: under its name, its signature as the code
 * declares it, in monospace — `(offer: Offer, user: UserId) →
 * DiscountedOffer`, then each field of its state on a line of its own —
 * each slot a badge in its relation's colour (relationEdges in theme.ts).
 * A behavior that gives nothing back says so where its output's type
 * would be, as code does: `(offer: Offer) → void`.
 * A badge whose type is still on the diagram is marked so; one whose type
 * is in hand is drawn as related to it. A badge typed by a block is a
 * button that opens the walk through what that type relates to (see
 * `SlotExplorer`); one typed by a primitive leads nowhere and is words.
 * They sit beside the card's own button, over it, never inside it: a
 * button holds no other.
 */
export function SlotBadges({
  badges,
  noOutput,
  frame,
}: {
  badges: readonly Badge[];
  /** A behavior that gives nothing back, which its signature says. */
  noOutput: boolean;
  /** Under a frame's name, rather than a card's name and what it is. */
  frame: boolean;
}) {
  const { elements } = useContext(ExplorationReadingContext);
  // A badge whose type is in hand says so; read for these badges alone.
  const selected = useSelectedAmong(badges.map(({ type }) => type));
  const lines = signatureLinesOf(badges, noOutput);
  if (lines.length === 0) return null;
  /** A slot, drawn in `className` as `children`: a button where its type leads on. */
  const slot = (badge: Badge, className: string, children: ReactNode) => {
    const shared = {
      className,
      'data-relation': badge.relation,
      'data-related': selected.has(badge.type) || undefined,
      // Said by the canvas's one tooltip, as a card's controls are.
      'data-tip': badgeTipOf(badge),
    };
    return elements.has(badge.type) ? (
      <Walked badge={badge} {...shared}>
        {children}
      </Walked>
    ) : (
      <span {...shared}>{children}</span>
    );
  };
  return (
    <div className={classes.badges} data-part="badges" data-frame={frame}>
      <div className={classes.signature}>
        {lines.map((line, at) => (
          <div key={at} className={classes.signatureLine}>
            {line.map((part, index) =>
              typeof part === 'string' ? (
                <span key={index} className={classes.punctuation} aria-hidden>
                  {part}
                </span>
              ) : part === NO_OUTPUT ? (
                <span
                  key={index}
                  className={classes.noOutput}
                  // Said by the canvas's one tooltip, as a badge is.
                  data-tip="No output"
                >
                  void
                </span>
              ) : (
                <span key={index} className={classes.signatureItem}>
                  {slot(
                    part.badge,
                    classes.token!,
                    <>
                      {/* An output by its type alone, as code returns it. */}
                      {part.named ? (
                        <>
                          <span className={classes.tokenName}>
                            {part.badge.name}
                          </span>
                          <span className={classes.punctuation}>: </span>
                        </>
                      ) : (
                        <VisuallyHidden>{part.badge.name}: </VisuallyHidden>
                      )}
                      <TypeOf badge={part.badge} />
                    </>,
                  )}
                </span>
              ),
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * A slot's type in bold, then its marks, which stay whole as it is cut
 * short: its cardinality, and a card of its own on the diagram (↗), faint.
 */
function TypeOf({ badge }: { badge: Badge }) {
  return (
    <span className={classes.type}>
      <span className={classes.typeName}>{badge.typeName}</span>
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
    </span>
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
  // The walk's popup is drawn once it is first asked for (use-lazy-opening.ts).
  const open = useCallback(
    (now: boolean) => {
      if (now) setView(recallSlotView());
      setPath(now ? [badge] : null);
    },
    [badge],
  );
  const { mounted, opener } = useLazyOpening(opened, open);
  return (
    <>
      <UnstyledButton
        {...shared}
        // A press on it is for the badge, not a drag or pan of the canvas.
        className={`nodrag nopan ${shared.className}`}
        // Named as the slot is written, an output's name with it.
        aria-label={`${badgeSaidOf(badge)}${badge.onDiagram ? ', also on the diagram' : ''}`}
        aria-haspopup="dialog"
        aria-expanded={opened}
        {...opener}
      >
        {children}
      </UnstyledButton>
      {mounted && (
        <Popover
          opened={opened}
          onChange={(now) => {
            if (!now) setPath(null);
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
            <span aria-hidden className={classes.opening} />
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
      )}
    </>
  );
}
