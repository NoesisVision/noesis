import {
  CardinalityMark,
  isMarked,
  markWordOf,
} from '#/features/design-docs/element-reader.ts';
import {
  type ExploredElement,
  groupLabelOf,
  type TypeRelations,
  type WalkStep,
} from '../../system-model-exploration.ts';
import { useThemedSurface } from './themes/diagram-theme-context.ts';
import classes from './slot-explorer.module.css';

/*
 * How a badge's popup words a slot and its type, in its heading and in
 * its tree alike: a type's kind, a slot's name with its behavior's, what
 * a reader hears for it, and its type with its cardinality's mark.
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

/**
 * A step's type as it is drawn: its name, then its cardinality's mark,
 * which says what it means on hover — nothing else in the popup does.
 */
export function TypeWords({ step }: { step: WalkStep }) {
  const surface = useThemedSurface('tooltip');
  return (
    <>
      {/* Its name is what a short line cuts; the mark stays whole. */}
      <span className={classes.typeText}>{step.typeName}</span>
      {isMarked(step.cardinality) && (
        <CardinalityMark
          cardinality={step.cardinality}
          tip
          tooltipProps={surface}
        />
      )}
    </>
  );
}

/** Whether a slot's type leads anywhere: a block's does, a primitive's not. */
export const opens = (step: WalkStep, elements: Elements) =>
  elements.has(step.type);

/** Whether a type relates to anything at all. */
export const relatesToAnything = (relations: TypeRelations) =>
  relations.state.length + relations.input.length + relations.output.length > 0;
