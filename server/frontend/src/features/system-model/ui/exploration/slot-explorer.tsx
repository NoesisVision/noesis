import {
  IconArrowBarRight,
  IconArrowUpRight,
  IconBoxMultiple,
  IconLayoutColumns,
  IconListTree,
} from '@tabler/icons-react';
import {
  type KeyboardEvent,
  type TransitionEvent,
  useEffect,
  useRef,
  useState,
} from 'react';
import { KindIcon } from '#/features/design-docs/element-reader.ts';
import { ActionIcon } from '#/shared/design-system/action-icon.tsx';
import { ScrollArea } from '#/shared/design-system/scroll-area.tsx';
import { SegmentedControl } from '#/shared/design-system/segmented-control.tsx';
import { Text } from '#/shared/design-system/text.tsx';
import { Tooltip } from '#/shared/design-system/tooltip.tsx';
import { UnstyledButton } from '#/shared/design-system/unstyled-button.tsx';
import { VisuallyHidden } from '#/shared/design-system/visually-hidden.tsx';
import {
  type ModelSlots,
  slotKeyOf,
  type WalkColumn,
  type WalkStep,
  walkKeyOf,
  walkChange,
  walkOf,
} from '../../system-model-exploration.ts';
import {
  type Elements,
  kindOf,
  RelationGroups,
  relatesToAnything,
  SlotCard,
  slotNameOf,
  TypeWords,
} from './slot-card.tsx';
import { SLOT_VIEWS, type SlotView } from './slot-view.ts';
import { SlotDrill, SlotNested, SlotTree } from './slot-views.tsx';
import classes from './slot-explorer.module.css';

/*
 * What a badge's type relates to, walked one type after another: the path
 * from the badge's slot, written as a dotted path, each step but the last a
 * way back to it; then a column for each step, as a file browser has, its
 * type's state and its behaviors' inputs and outputs, each a way on to the
 * next column. A slot typed by a primitive leads nowhere. A slot of a type
 * already passed through is marked so and still leads on: the walk goes as
 * far as the reader takes it. It only reads the model; nothing in it acts.
 *
 * Keys: ↑ and ↓ move along a column, → goes on into the next, ← back to
 * the one before; Escape closes it (the popover's own).
 *
 * A column opened grows out from the one before it; columns the walk leaves
 * — gone back from, or gone on from by another slot — fold away. A column
 * keeps its key while the walk keeps its way to it, so leaving only marks
 * it: drawn a moment longer, out of reach, until its folding ends. Both are
 * transitions, so a column the walk comes back to while it folds — or
 * leaves while it grows — turns round from where it is, never from scratch.
 *
 * Each row is a slot card, as the badge on the canvas is; a relation the
 * type has no slot of is not drawn, and a type with none says so under its
 * name.
 */

/** A column the walk has left, drawn until it has folded away. */
interface Leaving {
  key: string;
  index: number;
  column: WalkColumn;
}

/** The views a reader can walk in, by the icon and words of each. */
const VIEWS = [
  { value: 'columns', label: 'Columns', Icon: IconLayoutColumns },
  { value: 'tree', label: 'Tree', Icon: IconListTree },
  { value: 'drill', label: 'One at a time', Icon: IconArrowBarRight },
  { value: 'nested', label: 'Nested cards', Icon: IconBoxMultiple },
] satisfies { value: SlotView; label: string; Icon: typeof IconListTree }[];

export function SlotExplorer({
  path,
  onPath,
  slots,
  elements,
  onGoTo,
  view = 'columns',
  onView,
}: {
  /** The walk so far: the badge's own slot first. */
  path: readonly WalkStep[];
  onPath: (path: readonly WalkStep[]) => void;
  slots: ModelSlots;
  elements: Elements;
  /** Given when the badge's type has a card of its own: goes to it. */
  onGoTo?: () => void;
  /** How the walk is drawn, and the way to change it. */
  view?: SlotView;
  onView?: (view: SlotView) => void;
}) {
  const [root] = path;
  if (root === undefined) return null;
  const rootElement = elements.get(root.type);
  const goToLabel = `Go to ${root.typeName} on the diagram`;
  return (
    <div className={classes.explorer}>
      <div className={classes.head}>
        {/* The type, as a card names it: its kind's icon, its name, how
            many; then, when it has a card of its own, the way to it; and
            at the far end, how the walk is drawn. */}
        <div className={classes.title}>
          {rootElement !== undefined && (
            <KindIcon
              kind={rootElement.kind}
              pattern={rootElement.pattern}
              size={16}
            />
          )}
          <span className={classes.titleType}>
            <TypeWords step={root} />
          </span>
          {onGoTo !== undefined && (
            <Tooltip label={goToLabel}>
              <ActionIcon
                variant="subtle"
                size="sm"
                aria-label={goToLabel}
                onClick={onGoTo}
              >
                <IconArrowUpRight size={14} stroke={2} aria-hidden />
              </ActionIcon>
            </Tooltip>
          )}
          {onView !== undefined && (
            <SegmentedControl
              className={classes.views}
              size="xs"
              aria-label="Walk as"
              value={view}
              onChange={(value) => {
                const next = SLOT_VIEWS.find((each) => each === value);
                if (next !== undefined) onView(next);
              }}
              data={VIEWS.map(({ value, label, Icon }) => ({
                value,
                label: (
                  <Tooltip label={label} openDelay={300}>
                    <span className={classes.viewIcon}>
                      <Icon size={14} stroke={1.8} aria-hidden />
                      <VisuallyHidden>{label}</VisuallyHidden>
                    </span>
                  </Tooltip>
                ),
              }))}
            />
          )}
        </div>
        <Text component="span" fz="xs" c="dimmed">
          {kindOf(root.type, elements)}
        </Text>
      </div>
      {view === 'columns' && (
        <SlotColumns
          path={path}
          onPath={onPath}
          slots={slots}
          elements={elements}
        />
      )}
      {view === 'drill' && (
        <>
          <SlotPath path={path} onPath={onPath} />
          <SlotDrill
            path={path}
            onPath={onPath}
            slots={slots}
            elements={elements}
          />
        </>
      )}
      {view === 'tree' && (
        <SlotTree path={path} slots={slots} elements={elements} />
      )}
      {view === 'nested' && (
        <SlotNested path={path} slots={slots} elements={elements} />
      )}
    </div>
  );
}

/** The walk so far as a dotted path, each step but the last a way back to it. */
function SlotPath({
  path,
  onPath,
}: {
  path: readonly WalkStep[];
  onPath: (path: readonly WalkStep[]) => void;
}) {
  return (
    <nav className={classes.path} aria-label="Path">
      <span className={classes.steps}>
        {path.map((step, index) => (
          <span key={index} className={classes.step}>
            {index > 0 && (
              <span className={classes.dot} aria-hidden>
                .
              </span>
            )}
            {index === path.length - 1 ? (
              <span className={classes.token} aria-current="location">
                {step.name}
              </span>
            ) : (
              <UnstyledButton
                className={classes.token}
                onClick={() => onPath(path.slice(0, index + 1))}
                aria-label={`Back to ${step.name}: ${step.typeName}`}
              >
                {step.name}
              </UnstyledButton>
            )}
          </span>
        ))}
      </span>
    </nav>
  );
}

/** The walk as columns, one a step, as a file browser has. */
function SlotColumns({
  path,
  onPath,
  slots,
  elements,
}: {
  path: readonly WalkStep[];
  onPath: (path: readonly WalkStep[]) => void;
  slots: ModelSlots;
  elements: Elements;
}) {
  const columns = walkOf(slots, path);
  // The walk last drawn, to tell which columns a new one leaves.
  const [drawn, setDrawn] = useState(path);
  const [leaving, setLeaving] = useState<readonly Leaving[]>([]);
  // How the columns new to the walk come in, by key.
  const [entering, setEntering] = useState<
    ReadonlyMap<string, 'grows' | 'swaps'>
  >(new Map());
  if (drawn !== path) {
    const before = walkOf(slots, drawn);
    const now = new Set(path.map((_, index) => walkKeyOf(path, index)));
    const { folds, enters } = walkChange(
      drawn,
      path,
      new Set(leaving.map(({ index }) => index)),
    );
    const left = folds.map((index) => ({
      key: walkKeyOf(drawn, index),
      index,
      column: before[index]!,
    }));
    setDrawn(path);
    setEntering(enters);
    setLeaving((was) => [
      // A column the walk comes back to before it has folded is its own
      // again; one another column now stands in place of goes at once.
      ...was.filter(
        ({ key, index }) =>
          !now.has(key) &&
          index >= path.length &&
          !left.some((each) => each.key === key),
      ),
      ...left,
    ]);
  }
  const folded = (key: string) =>
    setLeaving((was) => was.filter((each) => each.key !== key));
  const strip = useRef<HTMLDivElement>(null);
  // Where the keys asked the focus to go once the columns are drawn anew.
  const focusNext = useRef<{ column: number; key: string | null } | null>(null);

  // The focus where the keys sent it, once the columns are drawn anew.
  useEffect(() => {
    const at = strip.current;
    if (at === null) return;
    const wanted = focusNext.current;
    focusNext.current = null;
    if (wanted === null) return;
    const rows = [
      ...at.querySelectorAll<HTMLElement>(
        `[data-column="${wanted.column}"] [data-row]`,
      ),
    ];
    (rows.find((row) => row.dataset.row === wanted.key) ?? rows[0])?.focus();
  }, [path]);

  const goOn = (column: number, step: WalkStep, byKey: boolean) => {
    if (byKey) focusNext.current = { column: column + 1, key: null };
    onPath([...path.slice(0, column + 1), step]);
  };

  /** ↑ ↓ along a column, → on into the next, ← back to the one before. */
  const onKeyDown = (
    event: KeyboardEvent<HTMLElement>,
    column: number,
    step: WalkStep,
  ) => {
    const rows = [
      ...(event.currentTarget
        .closest('[data-column]')
        ?.querySelectorAll<HTMLElement>('[data-row]') ?? []),
    ];
    const at = rows.indexOf(event.currentTarget);
    if (event.key === 'ArrowDown') rows[at + 1]?.focus();
    else if (event.key === 'ArrowUp') rows[at - 1]?.focus();
    else if (event.key === 'ArrowRight') goOn(column, step, true);
    else if (event.key === 'ArrowLeft' && column > 0)
      // The row the walk left the column before by.
      strip.current
        ?.querySelector<HTMLElement>(
          `[data-column="${column - 1}"] [data-row="${slotKeyOf(path[column]!)}"]`,
        )
        ?.focus();
    else return;
    event.preventDefault();
  };

  return (
    <>
      <SlotPath path={path} onPath={onPath} />
      <ScrollArea
        className={classes.strip}
        type="auto"
        scrollbars="x"
        offsetScrollbars="x"
      >
        <div className={classes.columns} ref={strip}>
          {/* One list, the columns the walk has and then those it left,
              so a column keeps its element as it goes from one to the other
              and its transition turns round rather than starting anew. */}
          {[
            ...columns.map((column, index) => (
              <Column
                key={walkKeyOf(path, index)}
                index={index}
                column={column}
                enter={entering.get(walkKeyOf(path, index))}
                elements={elements}
                onGoOn={(step, byKey) => goOn(index, step, byKey)}
                onKeyDown={(event, step) => onKeyDown(event, index, step)}
                // Grown out, the newest column is brought into view.
                onTransitionEnd={(event) => {
                  if (
                    event.target !== event.currentTarget ||
                    event.propertyName !== 'width'
                  )
                    return;
                  if (index === path.length - 1)
                    event.currentTarget.scrollIntoView({
                      behavior: 'smooth',
                      block: 'nearest',
                      inline: 'nearest',
                    });
                }}
              />
            )),
            ...leaving
              .toSorted((a, b) => a.index - b.index)
              .map(({ key, index, column }) => (
                <Column
                  key={key}
                  index={index}
                  column={column}
                  elements={elements}
                  leaving
                  onFolded={() => folded(key)}
                  onGoOn={() => {}}
                  onKeyDown={() => {}}
                  onTransitionEnd={(event) => {
                    if (
                      event.target === event.currentTarget &&
                      event.propertyName === 'width'
                    )
                      folded(key);
                  }}
                />
              )),
          ]}
        </div>
      </ScrollArea>
    </>
  );
}

function Column({
  index,
  column,
  elements,
  leaving = false,
  enter,
  onFolded,
  onGoOn,
  onKeyDown,
  onTransitionEnd,
}: {
  index: number;
  column: WalkColumn;
  /** Left by the walk: folding away, out of reach of the pointer, the keys and a reader. */
  leaving?: boolean;
  /** Folded with nothing to fold: left before it had grown at all. */
  onFolded?: () => void;
  /** New to the walk: grown out at its end, or swapped in where another stood. */
  enter?: 'grows' | 'swaps';
  onTransitionEnd: (event: TransitionEvent<HTMLElement>) => void;
  elements: Elements;
  onGoOn: (step: WalkStep, byKey: boolean) => void;
  onKeyDown: (event: KeyboardEvent<HTMLElement>, step: WalkStep) => void;
}) {
  const { step, relations, through, next } = column;
  const kind = kindOf(step.type, elements);
  // A column left before it had grown at all has no width to fold through,
  // so no end of folding comes: seen still a frame later, it goes at once.
  const section = useRef<HTMLElement>(null);
  useEffect(() => {
    if (!leaving) return;
    const frame = requestAnimationFrame(() => {
      if (section.current?.getAnimations().length === 0) onFolded?.();
    });
    return () => cancelAnimationFrame(frame);
  }, [leaving, onFolded]);
  return (
    <section
      ref={section}
      className={classes.column}
      data-column={leaving ? undefined : index}
      data-leaving={leaving || undefined}
      data-enter={enter}
      inert={leaving || undefined}
      aria-hidden={leaving || undefined}
      aria-label={`${step.typeName}, ${kind}`}
      onTransitionEnd={onTransitionEnd}
    >
      {/* As wide as a column, whatever width it is growing or folding through. */}
      <div className={classes.columnBody}>
        <div className={classes.columnHead} aria-hidden>
          {index > 0 && (
            <span className={classes.columnSlot}>{slotNameOf(step)}</span>
          )}
          <span className={classes.columnType}>
            <TypeWords step={step} />
          </span>
          <Text component="span" fz="xs" c="dimmed">
            {relatesToAnything(relations) ? kind : `${kind} · nothing inside`}
          </Text>
        </div>
        <RelationGroups relations={relations}>
          {(row) => (
            <SlotCard
              step={row}
              elements={elements}
              round={through.has(row.type)}
              current={next === slotKeyOf(row)}
              onOpen={(byKey) => onGoOn(row, byKey)}
              onKeyDown={(event) => onKeyDown(event, row)}
            />
          )}
        </RelationGroups>
      </div>
    </section>
  );
}
