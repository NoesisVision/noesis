import {
  addressOf,
  idPrefixOf,
  isElementId,
  isWithin,
  kindOf,
  parentOf,
} from '#/shared/model/element-id.ts';
import type {
  DesignDocumentInput,
  DesignedRelationKeyInput,
} from '#backend/app/design-docs/design-doc.ts';
import { writtenIn } from './change-set.ts';
import {
  isRemoved,
  keyOf,
  type LooseSet,
  matchesRef,
  relationsOf,
  type RuleInput,
  topSetOf,
  unitOf,
  unitStateOf,
  updateAt,
} from './design-doc-change-sets.ts';
import { valueOf } from './design-doc-field.ts';
import {
  CONTAINED_KINDS,
  type ElementKind,
  isOwnedPart,
  isPart,
  isRelationPart,
  SET_OF,
  type Unit,
  UNIT_LABEL,
  type UnitRef,
} from './design-doc-unit.ts';
import {
  CONTAINING_RELATION,
  CONTAINMENT_KINDS,
  GOVERNING_KINDS,
  isRelation,
  RELATION_KIND_OF,
  type RelationLike,
  relationKeyOf,
  relationsFrom,
  typeOf,
} from './relations.ts';

/*
 * The document changed as a whole by one unit: the relations that place it
 * joined or dropped, what is under it taken along, its id renamed.
 */

/**
 * The document with the relation that places `id` under its parent among
 * those it adds or removes. A root module is under nothing, and a parent the
 * design removes takes what is under it along.
 */
export function contained<Doc extends DesignDocumentInput>(
  doc: Doc,
  id: string,
  part: 'added' | 'removed',
): Doc {
  const parent = parentOf(id);
  if (parent === null || isRemoved(doc, parent)) return doc;
  const relation = {
    kind: CONTAINING_RELATION[kindOf(id) as ElementKind],
    from: parent,
    to: id,
  };
  const relations = relationsOf(doc);
  const key = relationKeyOf(relation);
  if (relations[part]?.some((item) => keyOf(item) === key)) return doc;
  return {
    ...doc,
    relations: { ...relations, [part]: [...(relations[part] ?? []), relation] },
  };
}

/** The document without the relation that places `id` under its parent, among those it adds or removes. */
export function uncontained<Doc extends DesignDocumentInput>(
  doc: Doc,
  id: string,
  part: 'added' | 'removed',
): Doc {
  const relations = relationsOf(doc);
  return {
    ...doc,
    relations: {
      ...relations,
      [part]: relations[part]?.filter(
        (item) =>
          !isRelation(item) ||
          !CONTAINMENT_KINDS.has(item.kind) ||
          item.to !== id,
      ),
    },
  };
}

/**
 * What a removal from the system writes for a unit: a relation's key — a
 * named slot's with the type the model has, which the edit carries, or else
 * the one the design gives it — and anything else's id or name.
 */
export function removalKeyOf(
  doc: DesignDocumentInput,
  ref: UnitRef,
  type: string | undefined,
): unknown {
  if (!isRelationPart(ref.kind) || !('owner' in ref)) return ref.id;
  const from = ref.owner.id;
  if (ref.kind === 'extends')
    return { kind: RELATION_KIND_OF.extends, from, to: ref.id };
  const unit = unitOf(doc, ref);
  const to = type ?? (unit === null ? null : typeOf(unit as RelationLike));
  if (to === null)
    throw new Error(
      `The type of ${ref.id} is not known, so it cannot be removed.`,
    );
  return {
    kind: RELATION_KIND_OF[ref.kind],
    from,
    to,
    name: ref.id,
  } as DesignedRelationKeyInput;
}

/**
 * A rule or a scenario added is joined to what it is shown under: a rule
 * governed by its behavior, a scenario illustrating its rule.
 */
export function joined<Doc extends DesignDocumentInput>(
  doc: Doc,
  ref: UnitRef,
): Doc {
  if (!('owner' in ref) || !isOwnedPart(ref.kind)) return doc;
  const { owner } = ref;
  const relation =
    ref.kind === 'rule'
      ? owner.kind === 'behavior'
        ? { kind: 'behavior_governs_rule', from: owner.id, to: ref.id }
        : null
      : owner.rule === undefined
        ? null
        : { kind: 'illustrates', from: ref.id, to: owner.rule };
  if (relation === null) return doc;
  const relations = (doc.relations ?? {}) as LooseSet;
  const key = relationKeyOf(relation as RelationLike);
  if ((relations.added ?? []).some((item) => keyOf(item) === key)) return doc;
  return {
    ...doc,
    relations: { ...relations, added: [...(relations.added ?? []), relation] },
  };
}

/**
 * A parameter added takes the place after the last the design gives the
 * behavior. The design does not see the scanned parameters, so one added
 * to a scanned behavior may share a place with one of theirs; they then
 * read in the order they stand.
 */
export function placed(
  doc: DesignDocumentInput,
  ref: UnitRef,
  unit: Unit,
): Unit {
  if (ref.kind !== 'parameter' || !('owner' in ref)) return unit;
  if ('position' in (unit as object)) return unit;
  const taken = writtenIn(relationsFrom(doc, 'parameter', ref.owner.id))
    .map(({ position }) => valueOf(position))
    .filter((position): position is number => typeof position === 'number');
  return {
    ...unit,
    position: {
      changed: true,
      value: Math.max(0, ...taken) + 1,
      author: 'human',
    },
  } as Unit;
}

export function written<Doc extends DesignDocumentInput>(
  doc: Doc,
  ref: UnitRef,
  unit: Unit,
): Doc {
  const state = unitStateOf(doc, ref);
  if (state === 'removed')
    throw new Error(
      `A removed ${UNIT_LABEL[ref.kind]} is restored before it is written: ${ref.id}`,
    );
  if (state === 'unchanged')
    return updateAt(doc, ref, (set) => ({
      ...set,
      modified: [...(set.modified ?? []), unit],
    }));
  const replaced = updateAt(doc, ref, (set) => ({
    ...set,
    [state]: (set[state] ?? []).map((item) =>
      matchesRef(ref, item) ? unit : item,
    ),
  }));
  const id = keyOf(unit);
  return id === ref.id || (isPart(ref.kind) && !isOwnedPart(ref.kind))
    ? replaced
    : renamed(replaced, ref.id, id);
}

export function discarded<Doc extends DesignDocumentInput>(
  doc: Doc,
  ref: UnitRef,
): Doc {
  const state = unitStateOf(doc, ref);
  const dropped = updateAt(doc, ref, (set) => ({
    ...set,
    added: set.added?.filter((item) => !matchesRef(ref, item)),
    modified: set.modified?.filter((item) => !matchesRef(ref, item)),
  }));
  if (state !== 'added') return dropped;
  // Nothing the design added can stand under one it no longer adds, no rule
  // answers a need it no longer states, and none stays that no behavior
  // the design adds follows.
  if (ref.kind === 'need') return untraced(dropped, ref.id);
  if (isPart(ref.kind) && !isOwnedPart(ref.kind)) return dropped;
  return withoutUngoverned(
    uncontained(withoutWithin(dropped, ref.id), ref.id, 'added'),
  );
}

/**
 * The document without the elements under `ancestor`, in any part of their
 * change sets, and without the relations from them or ending at them, the
 * ancestor's own included: a relation stands on both its ends. A slot typed
 * by one of them stays, for its holder to be retyped.
 */
export function withoutWithin<Doc extends DesignDocumentInput>(
  doc: Doc,
  ancestor: string,
): Doc {
  if (!isElementId(ancestor)) return doc;
  const outside = (item: unknown) => {
    const id = keyOf(item);
    return id === ancestor || !isWithin(id, ancestor);
  };
  const apart = (item: unknown) =>
    !isRelation(item) ||
    (!isWithin(item.from, ancestor) &&
      !(typeof item.to === 'string' && isWithin(item.to, ancestor)));
  const relations = relationsOf(doc);
  const kept = {
    ...doc,
    relations: {
      ...relations,
      added: relations.added?.filter(apart),
      modified: relations.modified?.filter(apart),
      removed: relations.removed?.filter(apart),
    },
  };
  return CONTAINED_KINDS.reduce((next, kind) => {
    const set = topSetOf(next, kind);
    return {
      ...next,
      [SET_OF[kind]]: {
        ...set,
        added: set.added?.filter(outside),
        modified: set.modified?.filter(outside),
        removed: set.removed?.filter(outside),
      },
    };
  }, kept);
}

/** The document without the rules it adds that no behavior or manual process it adds governs any longer. */
function withoutUngoverned<Doc extends DesignDocumentInput>(doc: Doc): Doc {
  const governed = new Set(
    ((doc.relations ?? {}) as LooseSet).added
      ?.filter(isRelation)
      .flatMap((relation) =>
        GOVERNING_KINDS.has(relation.kind) && typeof relation.to === 'string'
          ? [relation.to]
          : [],
      ),
  );
  const lost = (topSetOf(doc, 'rule').added ?? [])
    .map(keyOf)
    .filter((id) => !governed.has(id));
  return lost.reduce((next, id) => withoutWithin(next, id), doc);
}

function untraced<Doc extends DesignDocumentInput>(
  doc: Doc,
  needId: string,
): Doc {
  const untrace = (item: unknown): unknown => {
    const rule = item as RuleInput;
    const needs = valueOf(rule.needs);
    if (needs === null || !needs.includes(needId)) return rule;
    return {
      ...rule,
      needs: {
        changed: true,
        value: needs.filter((id) => id !== needId),
        author: 'human',
      },
    };
  };
  const set = topSetOf(doc, 'rule');
  return {
    ...doc,
    rules: {
      ...set,
      added: set.added?.map(untrace),
      modified: set.modified?.map(untrace),
    },
  };
}

/**
 * The document with an element's id moved, and every id under it: wherever
 * the document names one — a key, a relation's end, a slot's type.
 */
export function renamed<Node>(node: Node, from: string, to: string): Node {
  if (typeof node === 'string') {
    if (!isElementId(node) || !isWithin(node, from)) return node;
    const kind = idPrefixOf(node);
    return `${kind}${addressOf(to)}${addressOf(node).slice(addressOf(from).length)}` as Node;
  }
  if (Array.isArray(node))
    return node.map((item: unknown) => renamed(item, from, to)) as Node;
  if (typeof node === 'object' && node !== null)
    return Object.fromEntries(
      Object.entries(node).map(([prop, value]) => [
        prop,
        renamed(value, from, to),
      ]),
    ) as Node;
  return node;
}
