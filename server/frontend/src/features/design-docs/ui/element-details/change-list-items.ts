import type { OutlineChange } from '#/features/design-docs/ui/model-tree/model-outline.ts';
import type {
  DesignDocumentInput,
  DesignedRuleInput,
} from '#backend/app/design-docs/design-doc.ts';
import type { ChangeSetInput } from '../../change-set.ts';
import { valueOf } from '../../design-doc-field.ts';
import { partPathOf } from '../../design-doc-outline.ts';
import {
  classificationOf,
  type NeedsInput,
  needNamesOf,
} from '../../design-doc-requirements.ts';
import { blockOfRef } from '../../element-id.ts';
import {
  cardinalitySuffixOf,
  type DesignedInputInput,
  type DesignedStateInput,
  relationsFrom,
  relationsTo,
} from '../../relations.ts';
import { refAddressOf } from './ref-address.ts';

/*
 * What a list section shows, one line per thing the design touches: what it
 * does to it, how it reads, the row of the tree it opens, if any, and — for a
 * rule — the description the design gives it.
 */
export interface ChangeListItem {
  change: OutlineChange;
  label: string;
  path: string | null;
  description?: string;
  /** The key its change set knows it by: an input's name, an output's type. */
  key?: string;
  /** A property's or an input's name, apart from its type. */
  name?: string;
  /** The type it is declared with, by address. */
  type?: string;
  /** How many of the type it holds, as read after the type: ` [0..*]`; nothing for exactly one. */
  cardinality?: string;
  /** The row that type has in the tree, when it is a building block. */
  typePath?: string;
  /** How many scenarios a rule has, to point at them. */
  scenarios?: number;
  /** Those scenarios by name, to list where the count is pointed at. */
  scenarioNames?: string[];
  /** A rule's category and type, as far as the design writes them. */
  classification?: string;
  /** The needs a rule answers, by name; none for a design decision. */
  needs?: string[];
}

/** Every item of a change set, each with what the design does to it. */
function* changed<Item, Key>(
  set: ChangeSetInput<Item, Key> | undefined,
): Generator<[Item | Key, OutlineChange]> {
  for (const item of set?.added ?? []) yield [item, 'added'];
  for (const item of set?.modified ?? []) yield [item, 'modified'];
  for (const key of set?.removed ?? []) yield [key, 'removed'];
}

/** A type that names another building block, not a primitive. */
const isReference = (ref: string): boolean => blockOfRef(ref) !== null;

/** A declaration's name and type, apart, for a reader that sets them apart. */
const declared = (name: string, type: string, cardinality: string | null) => ({
  name,
  type: refAddressOf(type),
  ...withCardinality(cardinality),
  ...(isReference(type) ? { typePath: type } : {}),
});

const withCardinality = (cardinality: string | null) => {
  const suffix = cardinalitySuffixOf(cardinality);
  return suffix === '' ? {} : { cardinality: suffix };
};

/** The building blocks a block extends, each by its address, opening its row. */
export const extendsItems = (
  doc: DesignDocumentInput,
  blockId: string,
): ChangeListItem[] =>
  [...changed(relationsFrom(doc, 'extends', blockId))].map(
    ([relation, change]) => ({
      change,
      label: refAddressOf(relation.to),
      path: relation.to,
    }),
  );

/**
 * The building blocks the document says extend a type, each by its address
 * and opening its row; one the design stops extending it is listed as removed.
 */
export const extenderItems = (
  doc: DesignDocumentInput,
  id: string,
): ChangeListItem[] =>
  [...changed(relationsTo(doc, 'extends', id))].map(([relation, change]) => ({
    change,
    label: refAddressOf(relation.from),
    path: relation.from,
  }));

/** A named slot — a property, an input — as it would be declared, or by name when the type is kept. */
function slotItem(
  slot: DesignedStateInput | DesignedInputInput | { name: string },
  change: OutlineChange,
  path: string | null,
): ChangeListItem {
  if (!('to' in slot))
    return { change, key: slot.name, label: slot.name, path, name: slot.name };
  const type = valueOf(slot.to);
  const cardinality = valueOf(slot.cardinality);
  return {
    change,
    key: slot.name,
    label:
      type === null
        ? slot.name
        : `${slot.name}: ${refAddressOf(type)}${cardinalitySuffixOf(cardinality)}`,
    path: path ?? (type === null ? null : type),
    ...(type === null
      ? { name: slot.name }
      : declared(slot.name, type, cardinality)),
  };
}

/** A behavior's inputs, each opening its type. */
export const parameterItems = (
  doc: DesignDocumentInput,
  behaviorId: string,
): ChangeListItem[] =>
  [...changed(relationsFrom(doc, 'parameter', behaviorId))].map(
    ([parameter, change]) => slotItem(parameter, change, null),
  );

/** A behavior's results, each by its type, which it opens. */
export const resultItems = (
  doc: DesignDocumentInput,
  behaviorId: string,
): ChangeListItem[] =>
  [...changed(relationsFrom(doc, 'result', behaviorId))].map(
    ([result, change]) => {
      const cardinality =
        'cardinality' in result ? valueOf(result.cardinality) : null;
      const type = refAddressOf(result.to);
      return {
        change,
        key: result.to,
        label: `${type}${cardinalitySuffixOf(cardinality)}`,
        path: result.to,
        type,
        ...withCardinality(cardinality),
      };
    },
  );

/** A block's properties as they would be declared, or by name when the type is kept. */
export const propertyItems = (
  doc: DesignDocumentInput,
  blockId: string,
): ChangeListItem[] =>
  [...changed(relationsFrom(doc, 'property', blockId))].map(
    ([property, change]) =>
      slotItem(
        property,
        change,
        partPathOf(blockId, 'property', property.name),
      ),
  );

/** Rules, each by its name with what the design says of it and the needs it answers. */
export const ruleItems = (
  owner: string,
  set: ChangeSetInput<DesignedRuleInput, string> | undefined,
  needs?: NeedsInput,
): ChangeListItem[] =>
  [...changed(set)].map(([rule, change]) => {
    if (typeof rule === 'string')
      return { change, label: rule, path: partPathOf(owner, 'rule', rule) };
    const description = valueOf(rule.description)?.trim();
    const scenarioNames = [...changed(rule.scenarios)].map(([scenario]) =>
      typeof scenario === 'string' ? scenario : scenario.name,
    );
    const scenarios = scenarioNames.length;
    const classification = classificationOf(rule);
    const traced = valueOf(rule.needs);
    return {
      change,
      label: rule.name,
      path: partPathOf(owner, 'rule', rule.name),
      ...(description ? { description } : {}),
      ...(scenarios > 0 ? { scenarios, scenarioNames } : {}),
      ...(classification ? { classification } : {}),
      ...(traced ? { needs: needNamesOf(traced, needs) } : {}),
    };
  });
