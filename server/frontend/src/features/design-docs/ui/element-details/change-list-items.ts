import type {
  OutlineChange,
  OutlineKind,
} from '#/shared/ui/model-tree/model-outline.ts';
import type { OutlineTree } from '#/shared/ui/model-tree/outline-tree.ts';
import type {
  DesignedParameterInput,
  DesignedPropertyInput,
  DesignedResultInput,
  DesignedRuleInput,
  DesignedScenarioInput,
} from '#backend/app/design-docs/design-doc.ts';
import type { BuildingBlockRefInput } from '#backend/app/system-model/system-model.ts';
import { valueOf } from '../../design-doc-field.ts';
import { partPathOf } from '../../design-doc-outline.ts';
import type { ChangeSetInput } from './change-set.ts';
import { refAddressOf } from './ref-address.ts';

/*
 * What a list section shows, one line per thing the design touches: what it
 * does to it, how it reads, the row of the tree it opens, if any, and — for a
 * property, an input or an output — the description the design gives it.
 */
export interface ChangeListItem {
  change: OutlineChange;
  label: string;
  path: string | null;
  description?: string;
}

/** Every item of a change set, each with what the design does to it. */
function* changed<Item, Key>(
  set: ChangeSetInput<Item, Key> | undefined,
): Generator<[Item | Key, OutlineChange]> {
  for (const item of set?.added ?? []) yield [item, 'added'];
  for (const item of set?.modified ?? []) yield [item, 'modified'];
  for (const key of set?.removed ?? []) yield [key, 'removed'];
}

/** The id a type reference names, a collection by its item. */
const refIdOf = (ref: BuildingBlockRefInput): string =>
  typeof ref === 'string' ? ref : refIdOf(ref.collectionOf);

/** Type references — what a block implements, what a behaviour takes and gives. */
export const refItems = (
  set: ChangeSetInput<BuildingBlockRefInput, BuildingBlockRefInput> | undefined,
): ChangeListItem[] =>
  [...changed(set)].map(([ref, change]) => ({
    change,
    label: refAddressOf(ref),
    path: refIdOf(ref),
  }));

/** A behaviour's inputs as they would be declared, or by name when the type is kept; each opens its type. */
export const parameterItems = (
  set: ChangeSetInput<DesignedParameterInput, string> | undefined,
): ChangeListItem[] =>
  [...changed(set)].map(([parameter, change]) => {
    if (typeof parameter === 'string')
      return { change, label: parameter, path: null };
    const type = valueOf(parameter.type);
    const optional = valueOf(parameter.optional) ? '?' : '';
    const description = valueOf(parameter.description)?.trim();
    return {
      change,
      label:
        type === null
          ? parameter.name
          : `${parameter.name}${optional}: ${refAddressOf(type)}`,
      path: type === null ? null : refIdOf(type),
      ...(description ? { description } : {}),
    };
  });

/** A behaviour's results, each by its type, which it opens. */
export const resultItems = (
  set: ChangeSetInput<DesignedResultInput, BuildingBlockRefInput> | undefined,
): ChangeListItem[] =>
  [...changed(set)].map(([result, change]) => {
    // A removal names the result by its type alone.
    if (!isResult(result))
      return { change, label: refAddressOf(result), path: refIdOf(result) };
    const description = valueOf(result.description)?.trim();
    return {
      change,
      label: refAddressOf(result.type),
      path: refIdOf(result.type),
      ...(description ? { description } : {}),
    };
  });

const isResult = (
  item: DesignedResultInput | BuildingBlockRefInput,
): item is DesignedResultInput => typeof item === 'object' && 'type' in item;

/** Properties as they would be declared, or by name when the type is kept. */
export const propertyItems = (
  owner: string,
  set: ChangeSetInput<DesignedPropertyInput, string> | undefined,
): ChangeListItem[] =>
  [...changed(set)].map(([property, change]) => {
    if (typeof property === 'string')
      return {
        change,
        label: property,
        path: partPathOf(owner, 'property', property),
      };
    const type = valueOf(property.type);
    const optional = valueOf(property.optional) ? '?' : '';
    const description = valueOf(property.description)?.trim();
    return {
      change,
      label:
        type === null
          ? property.name
          : `${property.name}${optional}: ${refAddressOf(type)}`,
      path: partPathOf(owner, 'property', property.name),
      ...(description ? { description } : {}),
    };
  });

/**
 * The children of one kind a node has in the tree — a module's submodules and
 * building blocks, a block's behaviours — each as the tree has it. The tree
 * already holds an ancestor the document never names, so one that is only
 * there for what changed under it is listed too, and opens like any other.
 */
export const childItems = (
  tree: OutlineTree,
  path: string,
  kind: OutlineKind,
): ChangeListItem[] =>
  tree
    .childrenOf(path)
    .filter((child) => child.kind === kind)
    .map((child) => ({
      change: child.change,
      label: child.name,
      path: child.path,
    }));

/** Rules or scenarios, by name. */
export const partItems = (
  owner: string,
  kind: 'rule' | 'scenario',
  set:
    | ChangeSetInput<DesignedRuleInput | DesignedScenarioInput, string>
    | undefined,
): ChangeListItem[] =>
  [...changed(set)].map(([part, change]) => {
    const name = typeof part === 'string' ? part : part.name;
    return { change, label: name, path: partPathOf(owner, kind, name) };
  });
