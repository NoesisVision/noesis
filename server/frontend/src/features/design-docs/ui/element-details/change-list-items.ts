import type { OutlineChange } from '#/features/design-docs/ui/model-tree/model-outline.ts';
import type { DesignDocumentInput } from '#backend/app/design-docs/design-doc.ts';
import type { ChangeSetInput } from '../../change-set.ts';
import { valueOf } from '../../design-doc-field.ts';
import { partPathOf } from '../../design-doc-outline.ts';
import { needNamesOf } from '../../design-doc-requirements.ts';
import { addressOf, blockOfRef, nameOf } from '../../element-id.ts';
import { processPathOf, processPathUnder, stepsOf } from '../../people.ts';
import {
  cardinalitySuffixOf,
  OUTPUT_NAME,
  type RelationLike,
  relationsFrom,
  relationsTo,
  typeOf,
} from '../../relations.ts';
import {
  ruleKindLabelOf,
  ruleNameOf,
  rulesUnder,
  scenariosUnder,
} from '../../rules.ts';
import { isMarked, type MarkedCardinality } from './cardinality-mark.tsx';
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
  /** The key its change set knows it by: a property's or an input's name, an output's `result`, a rule's id. */
  key?: string;
  /** A property's or an input's name, apart from its type. */
  name?: string;
  /** The type it is declared with, by address. */
  type?: string;
  /** How many of the type it holds, when not exactly one: `*` or `0..1` (`CardinalityMark`). */
  cardinality?: MarkedCardinality;
  /** The row that type has in the tree, when it is a building block. */
  typePath?: string;
  /** How many scenarios a rule has, to point at them. */
  scenarios?: number;
  /** Those scenarios by name, to list where the count is pointed at. */
  scenarioNames?: string[];
  /** A rule's kind, as far as the design writes it. */
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

/** A declaration's name and type, apart, for a reader that sets them apart. */
const declared = (name: string, type: string, cardinality: string | null) => ({
  name,
  type: refAddressOf(type),
  ...withCardinality(cardinality),
  ...(blockOfRef(type) === null ? {} : { typePath: type }),
});

const withCardinality = (cardinality: string | null) =>
  isMarked(cardinality) ? { cardinality } : {};

/** How many a slot holds as the design writes it; a removal's key says nothing of it. */
const cardinalityOf = (slot: RelationLike): string | null =>
  'cardinality' in slot
    ? valueOf(slot.cardinality as { value: string } | undefined)
    : null;

/** The building blocks a block extends, each by its address, opening its row. */
export const extendedItems = (
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
  slot: RelationLike & { name: string },
  change: OutlineChange,
  path: string | null,
): ChangeListItem {
  const type = typeOf(slot);
  const cardinality = cardinalityOf(slot);
  if (type === null)
    return { change, key: slot.name, label: slot.name, path, name: slot.name };
  return {
    change,
    key: slot.name,
    label: `${slot.name}: ${refAddressOf(type)}${cardinalitySuffixOf(cardinality)}`,
    path: path ?? type,
    ...declared(slot.name, type, cardinality),
  };
}

/** A behavior's inputs in the order of its signature, each opening its type. */
export const parameterItems = (
  doc: DesignDocumentInput,
  behaviorId: string,
): ChangeListItem[] =>
  [...changed(relationsFrom(doc, 'parameter', behaviorId))].map(
    ([parameter, change]) => slotItem(parameter, change, null),
  );

/** What a behavior gives back, by its type, which it opens; by its name while the design keeps the type. */
export const resultItems = (
  doc: DesignDocumentInput,
  behaviorId: string,
): ChangeListItem[] =>
  [...changed(relationsFrom(doc, 'result', behaviorId))].map(
    ([result, change]) => {
      const type = typeOf(result);
      if (type === null)
        return { change, key: OUTPUT_NAME, label: OUTPUT_NAME, path: null };
      const cardinality = cardinalityOf(result);
      const address = refAddressOf(type);
      return {
        change,
        key: OUTPUT_NAME,
        label: `${address}${cardinalitySuffixOf(cardinality)}`,
        path: type,
        type: address,
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

/**
 * The rules shown under an element, each by its name with what the design
 * says of it, the needs it answers and the scenarios that illustrate it.
 */
export const ruleItems = (
  doc: DesignDocumentInput,
  owner: string,
  /** The row the rules hang under, when it is not the owner's id: a manual process under its actor. */
  at: string = owner,
): ChangeListItem[] =>
  [...changed(rulesUnder(doc, owner))].map(([rule, change]) => {
    const id = typeof rule === 'string' ? rule : rule.id;
    const path = partPathOf(at, 'rule', id);
    if (typeof rule === 'string')
      return { change, label: nameOf(id), key: id, path };
    const description = valueOf(rule.description)?.trim();
    const scenarioNames = [...changed(scenariosUnder(doc, id))].map(
      ([scenario]) =>
        typeof scenario === 'string' ? nameOf(scenario) : ruleNameOf(scenario),
    );
    const scenarios = scenarioNames.length;
    const classification = ruleKindLabelOf(valueOf(rule.kind));
    const traced = valueOf(rule.needs);
    return {
      change,
      label: ruleNameOf(rule),
      key: id,
      path,
      ...(description ? { description } : {}),
      ...(scenarios > 0 ? { scenarios, scenarioNames } : {}),
      ...(classification ? { classification } : {}),
      ...(traced ? { needs: needNamesOf(traced, doc.needs) } : {}),
    };
  });

/** The `performs` and `process_invokes_behavior` relations of a design, each with what the design does to it. */
const peopleRelations = (doc: DesignDocumentInput) =>
  [...changed(doc.relations)].filter(
    ([relation]) =>
      relation.kind === 'performs' ||
      relation.kind === 'process_invokes_behavior',
  );

/** The manual processes an actor performs, each opening its row under the actor. */
export const performedItems = (
  doc: DesignDocumentInput,
  actorId: string,
): ChangeListItem[] =>
  peopleRelations(doc).flatMap(([relation, change]) =>
    relation.kind === 'performs' && relation.from === actorId
      ? [
          {
            change,
            label: nameOf(relation.to),
            path: processPathUnder(actorId, relation.to),
          },
        ]
      : [],
  );

/** The actors who perform a manual process, each opening its row. */
export const performerItems = (
  doc: DesignDocumentInput,
  processId: string,
): ChangeListItem[] =>
  peopleRelations(doc).flatMap(([relation, change]) =>
    relation.kind === 'performs' && relation.to === processId
      ? [{ change, label: nameOf(relation.from), path: relation.from }]
      : [],
  );

/** The manual processes that invoke a behavior, each opening its first row. */
export const invokerItems = (
  doc: DesignDocumentInput,
  behaviorId: string,
): ChangeListItem[] =>
  peopleRelations(doc).flatMap(([relation, change]) =>
    relation.kind === 'process_invokes_behavior' && relation.to === behaviorId
      ? [
          {
            change,
            label: nameOf(relation.from),
            path: processPathOf(doc, relation.from),
          },
        ]
      : [],
  );

/** The behaviors a manual process invokes, in order, each by its block and name, its module under it. */
export const stepItems = (
  doc: DesignDocumentInput,
  processId: string,
): ChangeListItem[] =>
  stepsOf(doc, processId).map(({ behavior, order, change }) => {
    const address = addressOf(behavior).split('.');
    return {
      change,
      label: `${order === null ? '–' : order}. ${address.slice(-2).join('.')}`,
      path: behavior,
      description: address.slice(0, -2).join('.'),
    };
  });
