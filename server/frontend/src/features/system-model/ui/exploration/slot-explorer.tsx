import { IconChevronRight } from '@tabler/icons-react';
import { type KeyboardEvent, useEffect, useRef } from 'react';
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
 */

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
}: {
  /** The walk so far: the badge's own slot first. */
  path: readonly WalkStep[];
  onPath: (path: readonly WalkStep[]) => void;
  slots: ModelSlots;
  elements: Elements;
}) {
  const [root] = path;
  const columns = walkOf(slots, path);
  const strip = useRef<HTMLDivElement>(null);
  // Where the keys asked the focus to go once the columns are drawn anew.
  const focusNext = useRef<{ column: number; key: string | null } | null>(null);

  // The newest column brought into view, and the focus where it was sent.
  useEffect(() => {
    const at = strip.current;
    if (at === null) return;
    at.querySelector(`[data-column="${path.length - 1}"]`)?.scrollIntoView({
      block: 'nearest',
      inline: 'nearest',
    });
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
      </div>
      <nav className={classes.path} aria-label="Path">
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
      </nav>
      <ScrollArea type="auto" scrollbars="x" offsetScrollbars="x">
        <div className={classes.columns} ref={strip}>
          {columns.map((column, index) => (
            <Column
              key={index}
              index={index}
              column={column}
              elements={elements}
              onGoOn={(step, byKey) => goOn(index, step, byKey)}
              onKeyDown={(event, step) => onKeyDown(event, index, step)}
            />
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}

function Column({
  index,
  column,
  elements,
  onGoOn,
  onKeyDown,
}: {
  index: number;
  column: WalkColumn;
  elements: Elements;
  onGoOn: (step: WalkStep, byKey: boolean) => void;
  onKeyDown: (event: KeyboardEvent<HTMLElement>, step: WalkStep) => void;
}) {
  const { step, relations, through, next } = column;
  const groups: {
    relation: WalkStep['relation'];
    rows: readonly WalkStep[];
  }[] = [{ relation: 'state', rows: relations.state }];
  if (relations.behaves)
    groups.push(
      { relation: 'input', rows: relations.input },
      { relation: 'output', rows: relations.output },
    );
  return (
    <section
      className={classes.column}
      data-column={index}
      aria-label={`${step.typeName}, ${kindOf(step.type, elements)}`}
    >
      <div className={classes.columnHead} aria-hidden>
        <Text component="span" fz="sm" fw={600} truncate>
          {index > 0 ? `${step.name}: ${typeWordsOf(step)}` : typeWordsOf(step)}
        </Text>
        <Text component="span" fz="xs" c="dimmed">
          {kindOf(step.type, elements)}
        </Text>
      </div>
      {groups.map(({ relation, rows }) => (
        <div key={relation} className={classes.group}>
          <span
            className={classes.groupHead}
            data-relation={relation}
            aria-hidden
          >
            {relation}
            {rows.length === 0 && <span className={classes.none}>—</span>}
          </span>
          <ul className={classes.rows} aria-label={relation}>
            {rows.map((row) => {
              const key = slotKeyOf(row);
              const round = opens(row, elements) && through.has(row.type);
              const words = (
                <>
                  <span className={classes.go} aria-hidden>
                    {opens(row, elements) && (
                      <IconChevronRight size={12} stroke={2.2} />
                    )}
                  </span>
                  {row.behavior !== undefined && (
                    <span className={classes.via}>{row.behavior.name} ·</span>
                  )}
                  <span className={classes.name}>{row.name}</span>
                  {round && (
                    <span className={classes.round} aria-hidden>
                      ↺
                    </span>
                  )}
                  <span
                    className={classes.type}
                    data-primitive={!opens(row, elements) || undefined}
                  >
                    {typeWordsOf(row)}
                  </span>
                </>
              );
              const label = `${relation} ${row.behavior === undefined ? '' : `${row.behavior.name} `}${row.name}: ${typeWordsOf(row)}${round ? ', already on the path' : ''}`;
              return (
                <li key={key}>
                  {opens(row, elements) ? (
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
    </section>
  );
}
