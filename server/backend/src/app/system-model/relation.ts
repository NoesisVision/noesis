import { z } from 'zod';
import { BehaviorId, BuildingBlockId, ModuleId } from '#backend/app/element-id';

/*
 * A relation ties one element to another. An element carries its own
 * relations — those it is the source of — so `from` is the element's id and
 * `to` the id of the element at the other end, each an element id of the kind
 * the relation allows. Each relation is a type of its own, told apart by
 * `kind`, so that code can match on it; a union per element kind says which
 * relations an element may carry.
 */

/** A module contains a module nested in it. */
const ContainsModuleRelation = z.strictObject({
  kind: z.literal('contains_module'),
  from: ModuleId,
  to: ModuleId,
});
export type ContainsModuleRelation = z.infer<typeof ContainsModuleRelation>;

/** A module contains a building block. */
const ContainsBuildingBlockRelation = z.strictObject({
  kind: z.literal('contains_building_block'),
  from: ModuleId,
  to: BuildingBlockId,
});
export type ContainsBuildingBlockRelation = z.infer<
  typeof ContainsBuildingBlockRelation
>;

/** A building block exposes a behavior: one of its own public methods. */
const ExposesRelation = z.strictObject({
  kind: z.literal('exposes'),
  from: BuildingBlockId,
  to: BehaviorId,
});
export type ExposesRelation = z.infer<typeof ExposesRelation>;

/** A building block extends another: that one is among its direct supertypes (R4.4). */
export const ExtendsRelation = z.strictObject({
  kind: z.literal('extends'),
  from: BuildingBlockId,
  to: BuildingBlockId,
});
export type ExtendsRelation = z.infer<typeof ExtendsRelation>;

/** A behavior invokes another, directly or through methods that are no behavior; never itself. */
const InvokesRelation = z.strictObject({
  kind: z.literal('invokes'),
  from: BehaviorId,
  to: BehaviorId,
});
export type InvokesRelation = z.infer<typeof InvokesRelation>;

/** The relations a module is the source of. */
export const ModuleRelation = z.discriminatedUnion('kind', [
  ContainsModuleRelation,
  ContainsBuildingBlockRelation,
]);
export type ModuleRelation =
  | ContainsModuleRelation
  | ContainsBuildingBlockRelation;

/** The relations a building block is the source of. */
export const BuildingBlockRelation = z.discriminatedUnion('kind', [
  ExposesRelation,
  ExtendsRelation,
]);
export type BuildingBlockRelation = ExposesRelation | ExtendsRelation;

/** The relations a behavior is the source of. */
export const BehaviorRelation = z.discriminatedUnion('kind', [InvokesRelation]);
export type BehaviorRelation = InvokesRelation;

/** Any relation the system model knows, for matching on its `kind`. */
export const Relation = z.discriminatedUnion('kind', [
  ContainsModuleRelation,
  ContainsBuildingBlockRelation,
  ExposesRelation,
  ExtendsRelation,
  InvokesRelation,
]);
export type Relation =
  | ModuleRelation
  | BuildingBlockRelation
  | BehaviorRelation;

/** Whether a relation places its target under its source: the tree of modules, blocks and behaviors. */
export const isContainment = (relation: Relation): boolean =>
  relation.kind === 'contains_module' ||
  relation.kind === 'contains_building_block' ||
  relation.kind === 'exposes';

/** The relations an element is the source of: by kind in the order above, then by target; unique. */
export const relationsOf = <Schema extends z.ZodType<Relation>>(
  schema: Schema,
) =>
  z
    .array(schema)
    .default([])
    .describe(
      "The relations the element is the source of: every `from` is the element's own id. Sorted by kind, then by target; no two alike.",
    );
