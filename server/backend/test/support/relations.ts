import type {
  Relation,
  SystemModel,
} from '#backend/app/system-model/system-model';

/*
 * A system model's relations read from one end, the way the specs assert
 * them: a block's state, a behavior's inputs and output, what it extends
 * and what it invokes.
 */

type Built = Pick<SystemModel, 'relations'>;

const from = <K extends Relation['kind']>(
  model: Built,
  kind: K,
  id: string,
): Extract<Relation, { kind: K }>[] =>
  model.relations.filter(
    (r): r is Extract<Relation, { kind: K }> =>
      r.kind === kind && r.from === id,
  );

/** The `has_state` of a block as `[name, to, cardinality]`, in the model's order. */
export const stateOf = (model: Built, block: string): unknown[] =>
  from(model, 'has_state', block).map((r) => [r.name, r.to, r.cardinality]);

/** The `has_input` of a behavior as `[name, to, cardinality]`, by position: as the signature reads. */
export const inputOf = (model: Built, behavior: string): unknown[] =>
  from(model, 'has_input', behavior)
    .sort((a, b) => a.position - b.position)
    .map((r) => [r.name, r.to, r.cardinality]);

/** The `has_output` of a behavior as `[to, cardinality]`: one or none. */
export const outputOf = (model: Built, behavior: string): unknown[] =>
  from(model, 'has_output', behavior).map((r) => [r.to, r.cardinality]);

/** The blocks a block extends, in the model's order. */
export const extendsOf = (model: Built, block: string): string[] =>
  from(model, 'extends', block).map((r) => r.to);

/** The behaviors a behavior invokes, in call order. */
export const invokesOf = (model: Built, behavior: string): string[] =>
  from(model, 'behavior_invokes_behavior', behavior)
    .sort((a, b) => a.order - b.order)
    .map((r) => r.to);

/** The behaviors a behavior invokes, sorted by id: which, not in which order. */
export const invokedTargetsOf = (model: Built, behavior: string): string[] =>
  from(model, 'behavior_invokes_behavior', behavior)
    .map((r) => r.to)
    .sort(byCodeUnit);

/** Ids are ASCII, so code-unit order is alphabetical without a locale. */
const byCodeUnit = (a: string, b: string): number =>
  a < b ? -1 : a > b ? 1 : 0;
