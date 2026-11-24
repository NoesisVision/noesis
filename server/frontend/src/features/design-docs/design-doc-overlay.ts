import type { OutlineChange } from '#/features/design-docs/ui/model-tree/model-outline.ts';
import {
  type ElementChoice,
  NO_PICKS,
} from '#/features/system-model/exploration-choice.ts';
import { kindOf, nameOf, parentOf } from '#/shared/model/element-id.ts';
import type {
  DesignDocumentInput,
  DesignedRelationInput,
} from '#backend/app/design-docs/design-doc.ts';
import type {
  BuildingBlockKind,
  Relation,
  RuleKind,
  SourceLocation,
  SystemModel,
} from '#backend/app/system-model/system-model.ts';
import { type ChangeSetInput, changed } from './change-set.ts';
import { type DesignDocFieldInput, valueOf } from './design-doc-field.ts';
import {
  CONTAINING_RELATION,
  CONTAINMENT_KINDS,
  relationKeyOf,
} from './relations.ts';

/*
 * A design laid over the model it changes: the system model as it would be
 * with the design done, read so the model's exploration can draw a design
 * among what it touches. A design names the model's elements by the model's
 * own ids, so the two are merged by id. What the design adds is put in;
 * what it modifies is the model's element with the fields the design writes
 * written over it — a modified element may write nothing but its id; what it
 * removes stays in, so it can be drawn as removed. A relation the design
 * removes is left out: an edge cannot say yet that it is gone.
 *
 * An ancestor neither the design nor the model holds is conjured, as the
 * outline conjures it, and so is the containment that places an element
 * under its parent, which the ids already say.
 */

export interface DesignOverlay {
  /** The model with the design applied: what the exploration draws. */
  model: SystemModel;
  /** What the design does to each element it names; an element it leaves alone is absent. */
  changes: ReadonlyMap<string, OutlineChange>;
  /**
   * The elements drawn as cards that the design speaks of: those it adds,
   * modifies or removes, and those a relation it changes hangs from. Read
   * from the design, where the rest is read from the model.
   */
  designed: ReadonlySet<string>;
}

/** Where an element the design adds was found: nowhere yet. */
const NOWHERE: SourceLocation = { path: '', startLine: null, endLine: null };

/** A building block's type, when neither the design nor the model gives one. */
const NO_TYPE: BuildingBlockKind = 'value_object';

/** A rule's kind, when neither the design nor the model gives one. */
const NO_RULE_KIND: RuleKind = 'validation';

/** The elements that hang under one another by their ids, and are drawn so. */
type ContainedKind = keyof typeof CONTAINING_RELATION;

const isContained = (kind: string): kind is ContainedKind =>
  kind in CONTAINING_RELATION;

interface Written {
  id: string;
  name?: DesignDocFieldInput<string>;
  definition?: DesignDocFieldInput<string>;
  description?: DesignDocFieldInput<string>;
}

interface Scanned {
  id: string;
  name: string;
  description: string | null;
  source: SourceLocation;
}

/** What every element is built from: the design's word where it writes one, else the model's. */
const elementOf = <Base extends Scanned>(
  written: Written,
  base: Base | undefined,
): Scanned => ({
  id: written.id,
  name: valueOf(written.name) ?? base?.name ?? nameOf(written.id),
  description:
    valueOf(written.definition ?? written.description) ??
    base?.description ??
    null,
  source: base?.source ?? NOWHERE,
});

/** An element the design names only by id, which the model does not hold. */
const conjuredOf = (id: string): Scanned => ({
  id,
  name: nameOf(id),
  description: null,
  source: NOWHERE,
});

/**
 * One collection of the model with what the design does to it: each item
 * written over the model's, in the model's order, then the ones it adds.
 */
function merged<Element extends Scanned, Item extends Written>(
  scanned: readonly Element[],
  set: ChangeSetInput<Item, string> | undefined,
  apply: (item: Item, base: Element | undefined) => Element,
  conjure: (id: string) => Element,
  changes: Map<string, OutlineChange>,
): Element[] {
  const byId = new Map(scanned.map((element) => [element.id, element]));
  for (const [item, change] of changed(set)) {
    if (typeof item === 'string') {
      if (!byId.has(item)) byId.set(item, conjure(item));
      changes.set(item, change);
    } else {
      byId.set(item.id, apply(item, byId.get(item.id)));
      changes.set(item.id, change);
    }
  }
  return [...byId.values()];
}

/**
 * A relation as the model holds one: the design's fields read for their
 * values, a field it leaves alone read from the model's relation it
 * modifies.
 */
function relationOf(
  designed: DesignedRelationInput,
  base: Relation | undefined,
): Relation {
  const was = (base ?? {}) as Partial<Record<string, unknown>>;
  switch (designed.kind) {
    case 'has_state':
    case 'has_output':
      return {
        ...designed,
        to: valueOf(designed.to) ?? was.to,
        cardinality: valueOf(designed.cardinality) ?? was.cardinality,
      } as Relation;
    case 'has_input':
      return {
        ...designed,
        to: valueOf(designed.to) ?? was.to,
        cardinality: valueOf(designed.cardinality) ?? was.cardinality,
        position: valueOf(designed.position) ?? was.position,
      } as Relation;
    case 'behavior_invokes_behavior':
    case 'process_invokes_behavior':
      return {
        ...designed,
        order: valueOf(designed.order) ?? was.order ?? 0,
      } as Relation;
    default:
      return designed as Relation;
  }
}

/**
 * The model's relations with the design's: every one the design adds,
 * modifies or removes is taken out by its key, then the ones it writes are
 * put back in. A call joined twice keeps both, as long as the design leaves
 * it alone.
 */
function mergedRelations(
  scanned: readonly Relation[],
  set: DesignDocumentInput['relations'],
): Relation[] {
  const touched = new Set(
    [
      ...(set?.added ?? []),
      ...(set?.modified ?? []),
      ...(set?.removed ?? []),
    ].map(relationKeyOf),
  );
  const bases = new Map(
    scanned.map((relation) => [relationKeyOf(relation), relation]),
  );
  return [
    ...scanned.filter((relation) => !touched.has(relationKeyOf(relation))),
    ...[...(set?.added ?? []), ...(set?.modified ?? [])].map((designed) =>
      relationOf(designed, bases.get(relationKeyOf(designed))),
    ),
  ];
}

/** The elements an exploration draws, as cards. */
const CARD_KINDS: ReadonlySet<string> = new Set([
  'module',
  'building_block',
  'behavior',
  'actor',
  'manual_process',
]);

export function overlayOf(
  model: SystemModel,
  doc: DesignDocumentInput,
): DesignOverlay {
  const changes = new Map<string, OutlineChange>();
  const modules = merged(
    model.modules,
    doc.modules,
    (item, base) => elementOf(item, base) as (typeof model.modules)[number],
    (id) => conjuredOf(id) as (typeof model.modules)[number],
    changes,
  );
  const buildingBlocks = merged(
    model.buildingBlocks,
    doc.buildingBlocks,
    (item, base) =>
      ({
        ...elementOf(item, base),
        type: valueOf(item.type) ?? base?.type ?? NO_TYPE,
      }) as (typeof model.buildingBlocks)[number],
    (id) =>
      ({
        ...conjuredOf(id),
        type: NO_TYPE,
      }) as (typeof model.buildingBlocks)[number],
    changes,
  );
  const behaviors = merged(
    model.behaviors,
    doc.behaviors,
    (item, base) => elementOf(item, base) as (typeof model.behaviors)[number],
    (id) => conjuredOf(id) as (typeof model.behaviors)[number],
    changes,
  );
  const rules = merged(
    model.rules,
    doc.rules,
    (item, base) =>
      ({
        ...elementOf(item, base),
        kind: valueOf(item.kind) ?? base?.kind ?? NO_RULE_KIND,
      }) as (typeof model.rules)[number],
    (id) =>
      ({
        ...conjuredOf(id),
        kind: NO_RULE_KIND,
      }) as (typeof model.rules)[number],
    changes,
  );
  const scenarios = merged(
    model.scenarios,
    doc.scenarios,
    (item, base) =>
      ({
        ...elementOf(item, base),
        steps: valueOf(item.steps) ?? base?.steps ?? [],
      }) as (typeof model.scenarios)[number],
    (id) =>
      ({
        ...conjuredOf(id),
        steps: [] as (typeof model.scenarios)[number]['steps'],
      }) as (typeof model.scenarios)[number],
    changes,
  );
  const actors = merged(
    model.actors,
    doc.actors,
    (item, base) => elementOf(item, base) as (typeof model.actors)[number],
    (id) => conjuredOf(id) as (typeof model.actors)[number],
    changes,
  );
  const manualProcesses = merged(
    model.manualProcesses,
    doc.manualProcesses,
    (item, base) =>
      elementOf(item, base) as (typeof model.manualProcesses)[number],
    (id) => conjuredOf(id) as (typeof model.manualProcesses)[number],
    changes,
  );

  // The ancestors no one holds, conjured as the outline conjures them.
  const held = new Set<string>(
    [...modules, ...buildingBlocks, ...behaviors].map(({ id }) => id),
  );
  const missing: string[] = [];
  for (const id of held)
    for (
      let up = parentOf(id);
      up !== null && !held.has(up);
      up = parentOf(up)
    ) {
      held.add(up);
      missing.push(up);
    }
  for (const id of missing)
    if (kindOf(id) === 'module')
      modules.push(conjuredOf(id) as (typeof model.modules)[number]);
    else if (kindOf(id) === 'building_block')
      buildingBlocks.push({
        ...conjuredOf(id),
        type: NO_TYPE,
      } as (typeof model.buildingBlocks)[number]);

  // Containment the ids say and no relation writes.
  const relations = mergedRelations(model.relations, doc.relations);
  const placed = new Set<string>(
    relations
      .filter(({ kind }) => CONTAINMENT_KINDS.has(kind))
      .map(({ to }) => to),
  );
  for (const id of held) {
    const kind = kindOf(id);
    const parent = parentOf(id);
    if (placed.has(id) || parent === null || !isContained(kind)) continue;
    relations.push({
      kind: CONTAINING_RELATION[kind],
      from: parent,
      to: id,
    } as Relation);
  }

  // What the design speaks of, drawn as cards: what it names, and what a
  // relation it changes hangs from.
  const cards = new Set<string>(
    [...held, ...actors, ...manualProcesses].map((each) =>
      typeof each === 'string' ? each : each.id,
    ),
  );
  const owners = [
    ...(doc.relations?.added ?? []),
    ...(doc.relations?.modified ?? []),
    ...(doc.relations?.removed ?? []),
  ].map(({ from }) => from);
  const designed = new Set(
    [...changes.keys(), ...owners].filter(
      (id) => cards.has(id) && CARD_KINDS.has(kindOf(id)),
    ),
  );

  return {
    designed,
    model: {
      ...model,
      modules,
      buildingBlocks,
      behaviors,
      rules,
      scenarios,
      actors,
      manualProcesses,
      relations,
    },
    changes,
  };
}

/**
 * What the exploration of a design opens on: every element it speaks of,
 * and the modules and blocks that hold them, so a behavior is drawn on its
 * block. Nothing else of the model: the reader brings that in.
 */
export function opensOnOf({ model, designed }: DesignOverlay): ElementChoice {
  const held = new Set<string>(
    [...model.modules, ...model.buildingBlocks, ...model.behaviors].map(
      ({ id }) => id,
    ),
  );
  const added = new Set<string>();
  for (const id of designed) {
    added.add(id);
    for (let at = parentOf(id); at !== null && held.has(at); at = parentOf(at))
      added.add(at);
  }
  return { shown: new Set(), picks: { ...NO_PICKS, added } };
}
