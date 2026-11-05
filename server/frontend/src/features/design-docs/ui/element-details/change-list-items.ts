import type { OutlineChange } from '#/features/design-docs/ui/model-tree/model-outline.ts';
import type { DesignDocumentInput } from '#backend/app/design-docs/design-doc.ts';
import type { ChangeSetInput } from '../../change-set.ts';
import { type DesignDocFieldInput, valueOf } from '../../design-doc-field.ts';
import { partPathOf } from '../../design-doc-outline.ts';
import { needNamesOf } from '../../design-doc-requirements.ts';
import { addressOf, blockOfRef, nameOf } from '../../element-id.ts';
import { processPathOf, processPathUnder, stepsOf } from '../../people.ts';
import {
  cardinalitySuffixOf,
  type DesignedCollaboratorInput,
  type DesignedInputInput,
  type DesignedStateInput,
  relationsFrom,
  relationsTo,
} from '../../relations.ts';
import {
  ruleKindLabelOf,
  ruleNameOf,
  rulesUnder,
  scenariosUnder,
} from '../../rules.ts';
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
  /** The key its change set knows it by: an input's name, an output's type, a rule's id. */
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
  /** A rule's kind, as far as the design writes it. */
  classification?: string;
  /** The needs a rule answers, by name; none for a design decision. */
  needs?: string[];
  /** The label is one name, dots and all — a deployable unit's or a library's — never shortened to its last segment. */
  whole?: boolean;
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

/** A removed slot's key names its type outright; a designed slot's is a field. */
type SlotKey = { name: string; to?: string };

/** The type a slot points at: as its key says, as the design writes it, or null where the design leaves it. */
const typeOf = (
  to: string | DesignDocFieldInput<string> | undefined,
): string | null => (typeof to === 'string' ? to : valueOf(to));

/** A named slot — a property, an input — as it would be declared, or by name when the type is kept. */
function slotItem(
  slot: DesignedStateInput | DesignedInputInput | SlotKey,
  change: OutlineChange,
  path: string | null,
): ChangeListItem {
  const type = typeOf(slot.to);
  const cardinality = 'cardinality' in slot ? valueOf(slot.cardinality) : null;
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

/** A behavior's result, keyed by its one name and shown by its type, which it opens; by its name alone when the type is kept. */
export const resultItems = (
  doc: DesignDocumentInput,
  behaviorId: string,
): ChangeListItem[] =>
  [...changed(relationsFrom(doc, 'result', behaviorId))].map(
    ([result, change]) => {
      const type = typeOf(result.to);
      const cardinality =
        'cardinality' in result ? valueOf(result.cardinality) : null;
      if (type === null)
        return { change, key: result.name, label: result.name, path: null };
      return {
        change,
        key: result.name,
        label: `${refAddressOf(type)}${cardinalitySuffixOf(cardinality)}`,
        path: type,
        type: refAddressOf(type),
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

/** What a block works with, each as it would be declared, or by name when the block it is is kept. */
export const collaboratorItems = (
  doc: DesignDocumentInput,
  blockId: string,
): ChangeListItem[] =>
  [...changed(relationsFrom(doc, 'collaborator', blockId))].map(
    ([collaborator, change]) =>
      collaboratorItem(
        collaborator,
        change,
        partPathOf(blockId, 'collaborator', collaborator.name),
      ),
  );

function collaboratorItem(
  collaborator: DesignedCollaboratorInput | SlotKey,
  change: OutlineChange,
  path: string,
): ChangeListItem {
  const type = typeOf(collaborator.to);
  const cardinality =
    'cardinality' in collaborator ? valueOf(collaborator.cardinality) : null;
  const { name } = collaborator;
  return type === null
    ? { change, key: name, label: name, path, name }
    : {
        change,
        key: name,
        label: `${name}: ${refAddressOf(type)}${cardinalitySuffixOf(cardinality)}`,
        path,
        ...declared(name, type, cardinality),
      };
}

/**
 * The rules shown under an element, each by its name with what the design
 * says of it, the needs it answers and the scenarios that illustrate it.
 */
export const ruleItems = (
  doc: DesignDocumentInput,
  owner: string,
): ChangeListItem[] =>
  [...changed(rulesUnder(doc, owner))].map(([rule, change]) => {
    const id = typeof rule === 'string' ? rule : rule.id;
    const path = partPathOf(owner, 'rule', id);
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

/** What holds blocks or modules outside the module tree: a deployable unit, a library, a layer. */
type Holder = 'deployable_unit|' | 'library|' | 'layer|';

/** The relations of a design by which a deployable unit ships, a library provides or a layer places. */
const packagingRelations = (
  doc: DesignDocumentInput,
): [{ from: string; to: string }, OutlineChange][] =>
  [...changed(doc.relations)].flatMap(([relation, change]) =>
    relation.kind === 'unit_contains_module' ||
    relation.kind === 'library_contains_block' ||
    relation.kind === 'layer_contains_block'
      ? [[relation, change] as [{ from: string; to: string }, OutlineChange]]
      : [],
  );

/** The `container_contains_unit` relations of a design: a deployment container running a deployable unit. */
const hostsRelations = (
  doc: DesignDocumentInput,
): [{ from: string; to: string }, OutlineChange][] =>
  [...changed(doc.relations)].flatMap(([relation, change]) =>
    relation.kind === 'container_contains_unit'
      ? [[relation, change] as [{ from: string; to: string }, OutlineChange]]
      : [],
  );

/**
 * What a deployable unit, a library or a layer contains, each opening its
 * row: a unit's modules by their path, the blocks of a library or a layer
 * by name, their module under them.
 */
export const containedItems = (
  doc: DesignDocumentInput,
  artifactId: string,
): ChangeListItem[] =>
  packagingRelations(doc).flatMap(([relation, change]) => {
    if (relation.from !== artifactId) return [];
    const address = addressOf(relation.to).split('.');
    return [
      relation.to.startsWith('module|')
        ? { change, label: address.join('.'), path: relation.to }
        : {
            change,
            label: nameOf(relation.to),
            path: relation.to,
            description: address.slice(0, -1).join('.'),
          },
    ];
  });

/** The deployable units a module ships in, or the libraries or layers a block is in, each opening its row. */
export const packagedInItems = (
  doc: DesignDocumentInput,
  elementId: string,
  holder: Holder,
): ChangeListItem[] =>
  packagingRelations(doc).flatMap(([relation, change]) =>
    relation.to === elementId && relation.from.startsWith(holder)
      ? [
          {
            change,
            label: nameOf(relation.from),
            path: relation.from,
            whole: true,
          },
        ]
      : [],
  );

/** The deployable units a deployment container runs, each opening its row. */
export const hostsItems = (
  doc: DesignDocumentInput,
  containerId: string,
): ChangeListItem[] =>
  hostsRelations(doc).flatMap(([relation, change]) =>
    relation.from === containerId
      ? [{ change, label: nameOf(relation.to), path: relation.to, whole: true }]
      : [],
  );

/** The deployment containers a deployable unit runs in, each opening its row. */
export const hostedByItems = (
  doc: DesignDocumentInput,
  unitId: string,
): ChangeListItem[] =>
  hostsRelations(doc).flatMap(([relation, change]) =>
    relation.to === unitId
      ? [
          {
            change,
            label: nameOf(relation.from),
            path: relation.from,
            whole: true,
          },
        ]
      : [],
  );
