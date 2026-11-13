import { IconChevronRight } from '@tabler/icons-react';
import type { KeyboardEvent, ReactNode } from 'react';
import {
  CardinalityMark,
  isMarked,
  markWordOf,
} from '#/features/design-docs/element-reader.ts';
import { UnstyledButton } from '#/shared/design-system/unstyled-button.tsx';
import {
  type ExploredElement,
  groupLabelOf,
  slotKeyOf,
  type TypeRelations,
  type WalkStep,
} from '../../system-model-exploration.ts';
import classes from './slot-explorer.module.css';

/*
 * What every view of a badge's walk draws alike: a slot as a card — its
 * name, quiet, over its type in bold, the type's cardinality after it, and
 * a way on where its type leads somewhere — and a type's slots grouped by
 * relation, none drawn empty.
 */

export type Elements = ReadonlyMap<string, ExploredElement>;

/** What a type is, in words: its block's kind, or "Primitive". */
export const kindOf = (type: string, elements: Elements) => {
  const element = elements.get(type);
  if (element === undefined) return 'Primitive';
  return groupLabelOf(element.pattern ?? element.kind);
};

/** A step's type as it is said: `DiscountedProduct, many`. */
const typeSaidOf = (step: WalkStep) => {
  const word = markWordOf(step.cardinality);
  return word === null ? step.typeName : `${step.typeName}, ${word}`;
};

/** A slot as it is named: its behavior's name first, when one holds it. */
export const slotNameOf = (step: WalkStep) =>
  step.behavior === undefined
    ? step.name
    : `${step.behavior.name} · ${step.name}`;

/** A slot as a reader hears it: `input apply discountedOffer: DiscountedOffer`. */
export const slotLabelOf = (step: WalkStep, round: boolean) =>
  `${step.relation} ${step.behavior === undefined ? '' : `${step.behavior.name} `}${step.name}: ${typeSaidOf(step)}${round ? ', already on the path' : ''}`;

/** A step's type as it is drawn: its name, then its cardinality's mark. */
export function TypeWords({ step }: { step: WalkStep }) {
  return (
    <>
      {/* Its name is what a short line cuts; the mark stays whole. */}
      <span className={classes.typeText}>{step.typeName}</span>
      {isMarked(step.cardinality) && (
        <CardinalityMark cardinality={step.cardinality} />
      )}
    </>
  );
}

/** Whether a slot's type leads anywhere: a block's does, a primitive's not. */
export const opens = (step: WalkStep, elements: Elements) =>
  elements.has(step.type);

/**
 * A slot card: a button where its type leads on, words where it does not.
 * `round` marks a type the walk has passed through, which still leads on.
 */
export function SlotCard({
  step,
  elements,
  round,
  current = false,
  expanded,
  onOpen,
  onKeyDown,
}: {
  step: WalkStep;
  elements: Elements;
  round: boolean;
  /** The slot the walk went on by. */
  current?: boolean;
  /** Opened in place, where the view opens it so. */
  expanded?: boolean;
  /** Open: `byKey` when the keys asked, so the focus can follow. */
  onOpen?: (byKey: boolean) => void;
  onKeyDown?: (event: KeyboardEvent<HTMLElement>) => void;
}) {
  const leads = opens(step, elements);
  const words = (
    <>
      <span className={classes.rowWords}>
        <span className={classes.name}>{slotNameOf(step)}</span>
        <span className={classes.type}>
          <TypeWords step={step} />
        </span>
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
          data-expanded={expanded || undefined}
        />
      )}
    </>
  );
  // A primitive leads nowhere: words, not a way on.
  if (!leads)
    return (
      <span className={classes.row} data-leaf>
        {words}
      </span>
    );
  return (
    <UnstyledButton
      className={classes.row}
      data-row={slotKeyOf(step)}
      aria-current={current || undefined}
      aria-expanded={expanded}
      aria-label={slotLabelOf(step, round && leads)}
      onClick={(event) => onOpen?.(event.detail === 0)}
      onKeyDown={onKeyDown}
    >
      {words}
    </UnstyledButton>
  );
}

/** A type's slots grouped by relation, each group headed; none drawn empty. */
export function RelationGroups({
  relations,
  children,
}: {
  relations: TypeRelations;
  /** One slot's card, and whatever opens under it. */
  children: (step: WalkStep) => ReactNode;
}) {
  const all: { relation: WalkStep['relation']; rows: readonly WalkStep[] }[] = [
    { relation: 'state', rows: relations.state },
    { relation: 'input', rows: relations.input },
    { relation: 'output', rows: relations.output },
  ];
  return all
    .filter(({ rows }) => rows.length > 0)
    .map(({ relation, rows }) => (
      <div key={relation} className={classes.group} data-relation={relation}>
        <span className={classes.groupHead} aria-hidden>
          {relation}
        </span>
        <ul className={classes.rows} aria-label={relation}>
          {rows.map((row) => (
            <li key={slotKeyOf(row)}>{children(row)}</li>
          ))}
        </ul>
      </div>
    ));
}

/** Whether a type relates to anything at all. */
export const relatesToAnything = (relations: TypeRelations) =>
  relations.state.length + relations.input.length + relations.output.length > 0;
