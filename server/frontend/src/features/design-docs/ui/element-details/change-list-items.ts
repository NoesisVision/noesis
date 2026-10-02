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
} from '#backend/app/design-docs/design-doc.ts';
import type { BuildingBlockRefInput } from '#backend/app/system-model/system-model.ts';
import { valueOf } from '../../design-doc-field.ts';
import { partPathOf } from '../../design-doc-outline.ts';
import type { ChangeSetInput } from './change-set.ts';
import { refAddressOf } from './ref-address.ts';

/*
 * What a list section shows, one line per thing the design touches: what it
 * does to it, how it reads, the row of the tree it opens, if any, and — for a
 * property, a rule, an input or an output — the description the design gives it.
 */
export interface ChangeListItem {
  change: OutlineChange;
  label: string;
  path: string | null;
  description?: string;
  /** A property's or an input's name, apart from its type. */
  name?: string;
  /** The type it is declared with, by address; `?` already folded into the name. */
  type?: string;
  /** Whether that type is another building block rather than a primitive. */
  reference?: boolean;
  /** The row that type has in the tree, when it is a building block. */
  typePath?: string;
  /** How many scenarios a rule has, to point at them. */
  scenarios?: number;
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

/** A type that names another building block, not a primitive. */
const isReference = (ref: BuildingBlockRefInput): boolean =>
  refIdOf(ref).startsWith('building_block|');

/** A declaration's name and type, apart, for a reader that sets them apart. */
const declared = (name: string, type: BuildingBlockRefInput) => ({
  name,
  type: refAddressOf(type),
  reference: isReference(type),
  ...(isReference(type) ? { typePath: refIdOf(type) } : {}),
});

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
      return { change, label: parameter, path: null, name: parameter };
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
      ...(type === null
        ? { name: parameter.name }
        : declared(`${parameter.name}${optional}`, type)),
      ...(description ? { description } : {}),
    };
  });

/** A behaviour's results, each by its type, which it opens. */
export const resultItems = (
  set: ChangeSetInput<DesignedResultInput, BuildingBlockRefInput> | undefined,
): ChangeListItem[] =>
  [...changed(set)].map(([result, change]) => {
    // A removal names the result by its type alone.
    const type = isResult(result) ? result.type : result;
    const description = isResult(result)
      ? valueOf(result.description)?.trim()
      : undefined;
    return {
      change,
      label: refAddressOf(type),
      path: refIdOf(type),
      type: refAddressOf(type),
      reference: isReference(type),
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
        name: property,
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
      ...(type === null
        ? { name: property.name }
        : declared(`${property.name}${optional}`, type)),
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

/** Rules, each by its name with the description the design gives it. */
export const ruleItems = (
  owner: string,
  set: ChangeSetInput<DesignedRuleInput, string> | undefined,
): ChangeListItem[] =>
  [...changed(set)].map(([rule, change]) => {
    if (typeof rule === 'string')
      return { change, label: rule, path: partPathOf(owner, 'rule', rule) };
    const description = valueOf(rule.description)?.trim();
    const scenarios = [...changed(rule.scenarios)].length;
    return {
      change,
      label: rule.name,
      path: partPathOf(owner, 'rule', rule.name),
      ...(description ? { description } : {}),
      ...(scenarios > 0 ? { scenarios } : {}),
    };
  });
