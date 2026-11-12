import type { DesignDocViolation } from '#backend/app/design-docs/design-doc.ts';
import { UNIT_FIELDS } from './design-doc-drafts.ts';
import {
  COLLECTION_OF,
  type ElementKind,
  isOwnedPart,
  isRelationPart,
  PART_SET,
  type PeopleKind,
  type UnitRef,
  type UnitState,
} from './design-doc-unit.ts';
import { relationKeyOfPart } from './relations.ts';

/*
 * The server's refusals of a design, in words a reader acts on.
 */

const VIOLATION_MESSAGE: Record<DesignDocViolation['reason'], string> = {
  changedInGreenField:
    'There is no scanned model yet, so nothing can be modified or removed.',
  unknownElement: 'The scanned model has no such element.',
  unchangedFieldInAddedItem: 'A new element has to say this.',
  humanAuthor: 'Only a human may write this field.',
  diagramInDefinition:
    'Draw the diagram in its own field, not in the definition.',
  unknownNeed: 'It answers a need this design does not state.',
  ungovernedRule: 'A rule needs a behavior that follows it.',
  uncontained:
    'The design does not add the relation that places this element under the one it is in.',
  unknownRelationEnd:
    'Neither this design nor the scanned model has this element.',
  containmentOutsideIdPath:
    'What holds what is in the ids: a module contains only what its id names under it, a scenario illustrates only the rule its id names.',
};

export const violationsInWords = (
  violations: readonly DesignDocViolation[],
): string[] =>
  violations.map(
    ({ path, reason }) => `${VIOLATION_MESSAGE[reason]} (${path})`,
  );

/**
 * The violations on the unit's own fields, by form path, and the rest in
 * words, by the path the server names the unit by.
 */
export function violationsOf(
  ref: UnitRef,
  state: UnitState,
  violations: readonly DesignDocViolation[],
): { fields: Record<string, string>; rest: string[] } {
  const prefix = `${serverPathOf(ref, state)}.`;
  const specs = UNIT_FIELDS[ref.kind];
  const fields: Record<string, string> = {};
  const rest: string[] = [];
  for (const { path, reason } of violations) {
    const remainder = path.startsWith(prefix) ? path.slice(prefix.length) : '';
    const spec = specs.find(
      ({ prop }) =>
        prop !== '' && (remainder === prop || remainder.startsWith(`${prop}[`)),
    );
    if (spec !== undefined)
      fields[`fields.${spec.name}.value`] = VIOLATION_MESSAGE[reason];
    else rest.push(`${VIOLATION_MESSAGE[reason]} (${path})`);
  }
  return { fields, rest };
}

function serverPathOf(ref: UnitRef, state: UnitState): string {
  if (isRelationPart(ref.kind) && 'owner' in ref)
    return `relations.${state}[${relationKeyOfPart(ref.kind, ref.owner.id, ref.id)}]`;
  const at = `[${ref.id}]`;
  if (isOwnedPart(ref.kind)) return `${PART_SET[ref.kind]}.${state}${at}`;
  return `${COLLECTION_OF[ref.kind as 'need' | ElementKind | PeopleKind]}.${state}${at}`;
}

// --- The document's change sets, read loosely: every unit is known by its key ---
