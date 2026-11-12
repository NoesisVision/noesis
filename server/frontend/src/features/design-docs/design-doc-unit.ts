import { kindInProseOf } from '#/shared/model/element-words.ts';
import type {
  DesignDocumentInput,
  DesignedActorInput,
  DesignedBehaviorInput,
  DesignedBuildingBlockInput,
  DesignedDomainModuleInput,
  DesignedManualProcessInput,
  DesignedNeedInput,
  DesignedRuleInput,
  DesignedScenarioInput,
} from '#backend/app/design-docs/design-doc.ts';
import {
  type DesignedExtendsInput,
  type DesignedInputInput,
  type DesignedOutputInput,
  type DesignedStateInput,
  RELATION_KIND_OF,
  type RelationPartKind,
} from './relations.ts';

/*
 * What a design's units are: the kinds of unit, a reference to one, and
 * where each kind lives in the document. The base the rest of a revision is
 * built on; it imports none of it.
 */

export type ElementKind = 'module' | 'building_block' | 'behavior';

/** Who drives the system and the work they do: elements of no module. */
export type PeopleKind = 'actor' | 'manual_process';

export type OwnedPartKind = 'rule' | 'scenario';

type PartKind = OwnedPartKind | RelationPartKind;

export type UnitKind = 'need' | ElementKind | PeopleKind | PartKind;

/** The element a part is written under — a rule's behavior — and the rule for a scenario. */
export interface PartOwner {
  kind: ElementKind;
  id: string;
  rule?: string;
}

/**
 * A unit by what it is and where it is. A part's `id` is the key its change
 * set knows it by: a rule's or a scenario's id, a name — an output's is
 * always `result` — or an extended type's id.
 */
export type UnitRef =
  | { kind: 'need' | ElementKind | PeopleKind; id: string }
  | { kind: PartKind; id: string; owner: PartOwner };

/** What the design does to a unit: its place in the unit's change set. */
export type UnitState = 'added' | 'modified' | 'removed' | 'unchanged';

interface UnitOf {
  need: DesignedNeedInput;
  module: DesignedDomainModuleInput;
  building_block: DesignedBuildingBlockInput;
  behavior: DesignedBehaviorInput;
  actor: DesignedActorInput;
  manual_process: DesignedManualProcessInput;
  rule: DesignedRuleInput;
  scenario: DesignedScenarioInput;
  property: DesignedStateInput;
  parameter: DesignedInputInput;
  result: DesignedOutputInput;
  extends: DesignedExtendsInput;
}

export type Unit = UnitOf[UnitKind];

export const UNIT_LABEL: Record<UnitKind, string> = {
  need: kindInProseOf('need'),
  module: kindInProseOf('module'),
  building_block: kindInProseOf('building_block'),
  behavior: kindInProseOf('behavior'),
  actor: kindInProseOf('actor'),
  manual_process: kindInProseOf('manual_process'),
  rule: kindInProseOf('rule'),
  scenario: kindInProseOf('scenario'),
  property: 'property',
  parameter: 'input',
  result: 'output',
  extends: 'extended type',
};

export const COLLECTION_OF = {
  need: 'needs',
  module: 'modules',
  building_block: 'buildingBlocks',
  behavior: 'behaviors',
  actor: 'actors',
  manual_process: 'manualProcesses',
} as const satisfies Record<
  'need' | ElementKind | PeopleKind,
  keyof DesignDocumentInput
>;

export const PART_SET: Record<OwnedPartKind, string> = {
  rule: 'rules',
  scenario: 'scenarios',
};

export const ELEMENT_KINDS = ['module', 'building_block', 'behavior'] as const;

export const isRelationPart = (kind: UnitKind): kind is RelationPartKind =>
  kind in RELATION_KIND_OF;

/** A part with an id of its own, which its name gives it: a rule, a scenario. */
export const isOwnedPart = (kind: UnitKind): kind is OwnedPartKind =>
  kind in PART_SET;

export const isPart = (kind: UnitKind): kind is PartKind =>
  kind in PART_SET || isRelationPart(kind);

/** Where a new unit goes, or the unit a form revises. */
export type UnitTarget =
  | {
      mode: 'add';
      kind: 'need' | ElementKind | PeopleKind;
      parent: string | null;
    }
  | { mode: 'add'; kind: PartKind; owner: PartOwner }
  | { mode: 'edit'; ref: UnitRef };

export const kindOfTarget = (target: UnitTarget): UnitKind =>
  target.mode === 'add' ? target.kind : target.ref.kind;

/** The ref a target's unit has under a given id. */
export function refOfTarget(target: UnitTarget, id: string): UnitRef {
  if (target.mode === 'edit') return { ...target.ref, id } as UnitRef;
  return 'owner' in target
    ? { kind: target.kind, id, owner: target.owner }
    : { kind: target.kind, id };
}

/** The unit a part hangs under: its element, or the rule a scenario of a rule is in. */
export function ownerRefOf(ref: UnitRef): UnitRef | null {
  if (!('owner' in ref)) return null;
  const { owner } = ref;
  const element = { kind: owner.kind, id: owner.id };
  return owner.rule === undefined
    ? element
    : { kind: 'rule', id: owner.rule, owner: element };
}

export type DesignDocEdit =
  /** `first`: ahead of what the design already adds, the newest on top. */
  | { op: 'add'; ref: UnitRef; unit: Unit; first?: boolean }
  /** `unit` may carry another key than `ref`: an added unit renamed moves, an element with what is under it. */
  | { op: 'write'; ref: UnitRef; unit: Unit }
  /** `type`: a slot's type as the model has it, for a slot whose type the design leaves unsaid. */
  | { op: Removal; ref: UnitRef; type?: string }
  /** An element the design adds, under another parent — or, a module, at the top. */
  | { op: 'move'; ref: UnitRef; to: string | null }
  /** A part the design adds, written into another owner — a scenario into another rule. */
  | { op: 'relocate'; from: UnitRef; ref: UnitRef; unit: Unit };

/**
 * Taking a unit out, by what the design does to it: an added one is
 * discarded; a modified one is either left as the model has it or removed
 * from the system; a removed one is restored.
 */
export type Removal = 'discard' | 'removeFromSystem' | 'restore';

export const isElement = (kind: UnitKind): kind is ElementKind =>
  (ELEMENT_KINDS as readonly UnitKind[]).includes(kind);

/** The relation by which an element's parent contains it, by the element's kind. */

/** The kinds an element's id holds the ids of, at the top of the document. */
export const CONTAINED_KINDS = [...ELEMENT_KINDS, 'rule', 'scenario'] as const;

export type ContainedKind = (typeof CONTAINED_KINDS)[number];

export const SET_OF: Record<'need' | ContainedKind, keyof DesignDocumentInput> =
  {
    ...COLLECTION_OF,
    rule: 'rules',
    scenario: 'scenarios',
  };
