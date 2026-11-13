import { childIdOf, moduleOf } from '#/shared/model/element-id.ts';
import type { DesignDocumentInput } from '#backend/app/design-docs/design-doc.ts';
import { unitOf, unitStateOf } from './design-doc-change-sets.ts';
import { draftErrors } from './design-doc-draft-errors.ts';
import {
  draftOfUnit,
  idOfDraft,
  type InlineFields,
  unitFromDraft,
} from './design-doc-drafts.ts';
import { type FieldDraft } from './design-doc-field.ts';
import {
  type DesignDocEdit,
  type PartOwner,
  type UnitRef,
  type UnitTarget,
} from './design-doc-unit.ts';

/*
 * Edits made in place rather than in the editor: a field written where it
 * is read, a rule added with its classic scenarios.
 */

/**
 * A rule to write in place: added under a behavior, which governs it, with a
 * name no rule of its module has, and nothing said of it yet.
 */
export function newRuleOf(
  doc: DesignDocumentInput,
  owner: PartOwner,
  named?: string,
): DesignDocEdit {
  const idOf = (name: string) => childIdOf('rule', moduleOf(owner.id), name);
  const taken = (name: string) =>
    unitStateOf(doc, { kind: 'rule', id: idOf(name), owner }) !== 'unchanged';
  let name = named ?? 'New rule';
  if (named === undefined)
    for (let n = 2; taken(name); n += 1) name = `New rule ${n}`;
  const written = <T>(value: T) => ({
    changed: true as const,
    value,
    author: 'human' as const,
  });
  const id = idOf(name);
  return {
    op: 'add',
    first: true,
    ref: { kind: 'rule', id, owner },
    unit: {
      id,
      name: written(name),
      kind: written('validation'),
      description: written(''),
      needs: written([]),
    },
  };
}

/**
 * One unit with some of its fields written in place, as a human, the rest
 * as the design has them: the edit that saves it, and the id the unit has
 * after it — an added element renamed moves — or what is wrong with it.
 */
export function inlineEditOf(
  doc: DesignDocumentInput,
  ref: UnitRef,
  fields: InlineFields,
): { edit: DesignDocEdit; id: string } | { error: string } {
  const state = unitStateOf(doc, ref);
  const original = unitOf(doc, ref);
  const draft = draftOfUnit(ref.kind, original, state);
  for (const [name, value] of Object.entries(fields))
    (draft.fields as Record<string, FieldDraft<unknown>>)[name] = {
      written: true,
      value,
    };
  const target: UnitTarget = { mode: 'edit', ref };
  const [error] = Object.values(draftErrors(doc, target, draft));
  if (error !== undefined) return { error };
  const id = idOfDraft(doc, target, draft);
  return {
    edit: {
      op: 'write',
      ref,
      unit: unitFromDraft(
        ref.kind,
        draft,
        original,
        id,
        'owner' in ref ? ref.owner : null,
      ),
    },
    id,
  };
}
