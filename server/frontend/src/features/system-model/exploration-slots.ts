import { nameOf } from '#/shared/model/element-id.ts';
import type {
  Cardinality,
  SystemModel,
  TypeId,
} from '#backend/app/system-model/system-model.ts';
import type { DrawnRelationKind } from './exploration-relations.ts';

/*
 * The model's slots, read whole: a building block's pieces of state, and a
 * behavior's inputs and output, each with its name, its type and how many
 * it holds. The exploration draws a slot as an edge only when its type is a
 * card it can join; here a slot typed by a primitive is kept like any
 * other, so a card can carry all of its slots, and what a type relates to
 * can be walked from one type to the next, however far.
 */

/** The relations that are slots, as the explorer names them. */
export type SlotRelation = Extract<
  DrawnRelationKind,
  'state' | 'input' | 'output'
>;

export interface Slot {
  relation: SlotRelation;
  /** The block whose state it is, or the behavior whose input or output it is. */
  holder: string;
  name: string;
  /** A building block's id, or a primitive's (`primitive|uuid`). */
  type: TypeId;
  /** The block's own name, or the primitive's. */
  typeName: string;
  cardinality: Cardinality;
  /** Where an input stands in its behavior's signature, from 1; null for state and output. */
  position: number | null;
}

/** A behavior a block exposes, as a type's relations name it. */
interface ExposedBehavior {
  id: string;
  name: string;
}

export interface ModelSlots {
  /** Each holder's slots: a block's state in the model's order, a behavior's inputs by position, then its output. */
  of: ReadonlyMap<string, readonly Slot[]>;
  /** The behaviors each block exposes, in the model's order. */
  behaviors: ReadonlyMap<string, readonly ExposedBehavior[]>;
}

const NONE: readonly Slot[] = [];

export function slotsOf(model: SystemModel): ModelSlots {
  const behaviorName = new Map(
    model.behaviors.map(({ id, name }) => [id, name]),
  );
  const of = new Map<string, Slot[]>();
  const behaviors = new Map<string, ExposedBehavior[]>();
  const add = (slot: Slot) =>
    of.set(slot.holder, [...(of.get(slot.holder) ?? []), slot]);
  const slot = (
    relation: SlotRelation,
    found: {
      from: string;
      to: TypeId;
      name: string;
      cardinality: Cardinality;
    },
    position: number | null,
  ): Slot => ({
    relation,
    holder: found.from,
    name: found.name,
    type: found.to,
    typeName: nameOf(found.to),
    cardinality: found.cardinality,
    position,
  });
  for (const relation of model.relations)
    switch (relation.kind) {
      case 'has_state':
        add(slot('state', relation, null));
        break;
      case 'has_input':
        add(slot('input', relation, relation.position));
        break;
      case 'has_output':
        add(slot('output', relation, null));
        break;
      case 'exposes': {
        const name = behaviorName.get(relation.to);
        if (name === undefined) break;
        behaviors.set(relation.from, [
          ...(behaviors.get(relation.from) ?? []),
          { id: relation.to, name },
        ]);
        break;
      }
    }
  // A behavior reads as its signature does: inputs in order, then what it
  // gives back. A block's state keeps the model's order.
  const rank = (one: Slot) =>
    one.relation === 'input' ? (one.position ?? 0) : Infinity;
  for (const [holder, list] of of)
    if (list.some(({ relation }) => relation !== 'state'))
      of.set(
        holder,
        list.toSorted((a, b) => rank(a) - rank(b)),
      );
  return { of, behaviors };
}

/** One of a type's behaviors' slots, with the behavior it belongs to. */
interface BehaviorSlot extends Slot {
  behavior: ExposedBehavior;
}

/**
 * What a type relates to, by relation: its state, and the inputs and
 * outputs of the behaviors it exposes, behavior by behavior. A primitive,
 * or a block with none of these, relates to nothing.
 */
export interface TypeRelations {
  state: readonly Slot[];
  input: readonly BehaviorSlot[];
  output: readonly BehaviorSlot[];
  /** Whether the type exposes any behavior, so has inputs and outputs to show, even none. */
  behaves: boolean;
}

export function relationsOfType(
  slots: ModelSlots,
  type: string,
): TypeRelations {
  const exposed = slots.behaviors.get(type) ?? [];
  const ofBehaviors = exposed.flatMap((behavior) =>
    (slots.of.get(behavior.id) ?? NONE).map((one) => ({ ...one, behavior })),
  );
  return {
    state: (slots.of.get(type) ?? NONE).filter(
      ({ relation }) => relation === 'state',
    ),
    input: ofBehaviors.filter(({ relation }) => relation === 'input'),
    output: ofBehaviors.filter(({ relation }) => relation === 'output'),
    behaves: exposed.length > 0,
  };
}

/** A step of a walk through the model's types: a slot, and its behavior when a type's behavior holds it. */
export type WalkStep = Slot & { behavior?: ExposedBehavior };

/** A step's key among its column's: its relation, its behavior, its name. */
export const slotKeyOf = (step: WalkStep) =>
  `${step.relation}|${step.behavior?.id ?? ''}|${step.name}`;

/** One column of a walk: a type, what it relates to, and where the walk went from it. */
export interface WalkColumn {
  step: WalkStep;
  relations: TypeRelations;
  /** The types walked through to here, this one too: a slot of one of them leads round again. */
  through: ReadonlySet<string>;
  /** The key of the slot the walk went on by, if it went on. */
  next: string | null;
}

/**
 * A walk from a slot through the types it leads to, a column for each step:
 * what each type relates to, and which slot the walk went on by. A walk
 * may come round to a type it passed through and go on, as far as the
 * reader takes it.
 */
export function walkOf(
  slots: ModelSlots,
  path: readonly WalkStep[],
): WalkColumn[] {
  return path.map((step, index) => ({
    step,
    relations: relationsOfType(slots, step.type),
    through: new Set(path.slice(0, index + 1).map(({ type }) => type)),
    next: index + 1 < path.length ? slotKeyOf(path[index + 1]!) : null,
  }));
}
