import { IconArrowUpRight, IconChevronRight } from '@tabler/icons-react';
import {
  type KeyboardEvent,
  type TransitionEvent,
  useEffect,
  useRef,
  useState,
} from 'react';
import { cardinalitySuffixOf } from '#/features/design-docs/cardinality.ts';
import { ScrollArea } from '#/shared/design-system/scroll-area.tsx';
import { Text } from '#/shared/design-system/text.tsx';
import { UnstyledButton } from '#/shared/design-system/unstyled-button.tsx';
import {
  type ExploredElement,
  groupLabelOf,
  type ModelSlots,
  slotKeyOf,
  type WalkColumn,
  type WalkStep,
  walkKeyOf,
  walkChange,
  walkOf,
} from '../../system-model-exploration.ts';
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

type Elements = ReadonlyMap<string, ExploredElement>;

/** What a type is, in words: its block's kind, or "Primitive". */
const kindOf = (type: string, elements: Elements) => {
  const element = elements.get(type);
  if (element === undefined) return 'Primitive';
  return groupLabelOf(element.pattern ?? element.kind);
};

const typeWordsOf = (step: WalkStep) =>
  `${step.typeName}${cardinalitySuffixOf(step.cardinality)}`;

/** What a step is to what holds it: `Input 1`, `Output`, `State`. */
const roleOf = (step: WalkStep) =>
  step.relation === 'input' && step.position !== null
    ? `Input ${step.position}`
    : step.relation === 'output'
      ? 'Output'
      : 'State';

const opens = (step: WalkStep, elements: Elements) => elements.has(step.type);

export function SlotExplorer({
  path,
  onPath,
  slots,
  elements,
  onGoTo,
}: {
  /** The walk so far: the badge's own slot first. */
  path: readonly WalkStep[];
  onPath: (path: readonly WalkStep[]) => void;
  slots: ModelSlots;
  elements: Elements;
  /** Given when the badge's type has a card of its own: goes to it. */
  onGoTo?: () => void;
}) {
  const [root] = path;
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

  if (root === undefined) return null;

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
    <div className={classes.explorer}>
      <div className={classes.head}>
        <Text component="span" ff="monospace" fz="sm">
          {root.name}: <b>{root.typeName}</b>
          {cardinalitySuffixOf(root.cardinality)}
        </Text>
        <Text component="span" fz="xs" c="dimmed">
          {`${roleOf(root)} · ${kindOf(root.type, elements)}`}
        </Text>
        {/* The badge's ↗ said in words, and the way to the card it means. */}
        {onGoTo !== undefined && (
          <UnstyledButton className={classes.goTo} onClick={onGoTo}>
            <IconArrowUpRight size={14} stroke={2} aria-hidden />
            {`Go to ${root.typeName} on the diagram`}
          </UnstyledButton>
        )}
      </div>
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
      <ScrollArea type="auto" scrollbars="x" offsetScrollbars="x">
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
    </div>
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
  // Only the relations the type has slots of: none is drawn empty.
  const all: { relation: WalkStep['relation']; rows: readonly WalkStep[] }[] = [
    { relation: 'state', rows: relations.state },
    { relation: 'input', rows: relations.input },
    { relation: 'output', rows: relations.output },
  ];
  const groups = all.filter(({ rows }) => rows.length > 0);
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
            <span className={classes.columnSlot}>
              {step.behavior === undefined
                ? step.name
                : `${step.behavior.name} · ${step.name}`}
            </span>
          )}
          <Text component="span" fz="sm" fw={600} truncate>
            {typeWordsOf(step)}
          </Text>
          <Text component="span" fz="xs" c="dimmed">
            {groups.length === 0 ? `${kind} · nothing inside` : kind}
          </Text>
        </div>
        {groups.map(({ relation, rows }) => (
          <div
            key={relation}
            className={classes.group}
            data-relation={relation}
          >
            <span className={classes.groupHead} aria-hidden>
              {relation}
            </span>
            <ul className={classes.rows} aria-label={relation}>
              {rows.map((row) => {
                const key = slotKeyOf(row);
                const leads = opens(row, elements);
                const round = leads && through.has(row.type);
                // A slot card, as the badge on the canvas is: its name,
                // quiet, over its type in bold, and a way on after them.
                const words = (
                  <>
                    <span className={classes.rowWords}>
                      <span className={classes.name}>
                        {row.behavior === undefined
                          ? row.name
                          : `${row.behavior.name} · ${row.name}`}
                      </span>
                      <span className={classes.type}>{typeWordsOf(row)}</span>
                    </span>
                    {round && (
                      <span className={classes.round} aria-hidden>
                        ↺
                      </span>
                    )}
                    {leads && (
                      <IconChevronRight
                        className={classes.go}
                        size={14}
                        stroke={2.2}
                        aria-hidden
                      />
                    )}
                  </>
                );
                const label = `${relation} ${row.behavior === undefined ? '' : `${row.behavior.name} `}${row.name}: ${typeWordsOf(row)}${round ? ', already on the path' : ''}`;
                return (
                  <li key={key}>
                    {leads ? (
                      <UnstyledButton
                        className={classes.row}
                        data-row={key}
                        aria-current={next === key || undefined}
                        aria-label={label}
                        onClick={(event) => onGoOn(row, event.detail === 0)}
                        onKeyDown={(event: KeyboardEvent<HTMLElement>) =>
                          onKeyDown(event, row)
                        }
                      >
                        {words}
                      </UnstyledButton>
                    ) : (
                      // A primitive leads nowhere: words, not a way on.
                      <span className={classes.row} data-leaf>
                        {words}
                      </span>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </div>
    </section>
  );
}
