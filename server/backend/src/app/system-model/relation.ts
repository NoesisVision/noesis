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
const ModuleContainsModuleRelation = z.strictObject({
  kind: z.literal('module_contains_module'),
  from: ModuleId,
  to: ModuleId,
});
export type ModuleContainsModuleRelation = z.infer<
  typeof ModuleContainsModuleRelation
>;

/** A module contains a building block. */
const ModuleContainsBuildingBlockRelation = z.strictObject({
  kind: z.literal('module_contains_building_block'),
  from: ModuleId,
  to: BuildingBlockId,
});
export type ModuleContainsBuildingBlockRelation = z.infer<
  typeof ModuleContainsBuildingBlockRelation
>;

/** A building block exposes a behavior: one of its own public methods. */
const BuildingBlockExposesBehaviorRelation = z.strictObject({
  kind: z.literal('building_block_exposes_behavior'),
  from: BuildingBlockId,
  to: BehaviorId,
});
export type BuildingBlockExposesBehaviorRelation = z.infer<
  typeof BuildingBlockExposesBehaviorRelation
>;

/** A building block extends another: that one is among its direct supertypes (R4.4). */
export const BuildingBlockExtendsBuildingBlockRelation = z.strictObject({
  kind: z.literal('building_block_extends_building_block'),
  from: BuildingBlockId,
  to: BuildingBlockId,
});
export type BuildingBlockExtendsBuildingBlockRelation = z.infer<
  typeof BuildingBlockExtendsBuildingBlockRelation
>;

/** A behavior invokes another, directly or through methods that are no behavior; never itself. */
const BehaviorInvokesBehaviorRelation = z.strictObject({
  kind: z.literal('behavior_invokes_behavior'),
  from: BehaviorId,
  to: BehaviorId,
});
export type BehaviorInvokesBehaviorRelation = z.infer<
  typeof BehaviorInvokesBehaviorRelation
>;

/** The relations a module is the source of. */
export const ModuleRelation = z.discriminatedUnion('kind', [
  ModuleContainsModuleRelation,
  ModuleContainsBuildingBlockRelation,
]);
export type ModuleRelation =
  | ModuleContainsModuleRelation
  | ModuleContainsBuildingBlockRelation;

/** The relations a building block is the source of. */
export const BuildingBlockRelation = z.discriminatedUnion('kind', [
  BuildingBlockExposesBehaviorRelation,
  BuildingBlockExtendsBuildingBlockRelation,
]);
export type BuildingBlockRelation =
  | BuildingBlockExposesBehaviorRelation
  | BuildingBlockExtendsBuildingBlockRelation;

/** The relations a behavior is the source of. */
export const BehaviorRelation = z.discriminatedUnion('kind', [
  BehaviorInvokesBehaviorRelation,
]);
export type BehaviorRelation = BehaviorInvokesBehaviorRelation;

/** Any relation the system model knows, for matching on its `kind`. */
export const Relation = z.discriminatedUnion('kind', [
  ModuleContainsModuleRelation,
  ModuleContainsBuildingBlockRelation,
  BuildingBlockExposesBehaviorRelation,
  BuildingBlockExtendsBuildingBlockRelation,
  BehaviorInvokesBehaviorRelation,
]);
export type Relation =
  | ModuleRelation
  | BuildingBlockRelation
  | BehaviorRelation;

/** Whether a relation places its target under its source: the tree of modules, blocks and behaviors. */
export const isContainment = (relation: Relation): boolean =>
  relation.kind === 'module_contains_module' ||
  relation.kind === 'module_contains_building_block' ||
  relation.kind === 'building_block_exposes_behavior';

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
