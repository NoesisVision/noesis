import type { OutlineChange } from '#/shared/ui/model-tree/model-outline.ts';
import type {
  DesignedPropertyInput,
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
 * does to it, how it reads, and the row of the tree it opens, if any.
 */
export interface ChangeListItem {
  change: OutlineChange;
  label: string;
  path: string | null;
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
    return {
      change,
      label:
        type === null
          ? property.name
          : `${property.name}${optional}: ${refAddressOf(type)}`,
      path: partPathOf(owner, 'property', property.name),
    };
  });

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
