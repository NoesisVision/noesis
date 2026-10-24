import type { DesignDocFieldAuthor } from '#backend/app/design-docs/design-doc-field.ts';
import type { BuildingBlockRefInput } from '#backend/app/system-model/system-model.ts';
import { nameOf } from './element-id.ts';

/*
 * A field of a designed element as the wire carries it: left out or marked
 * unchanged when the design keeps what the model already says, or written
 * with the value the design gives it and who stands behind that value.
 */
export type DesignDocFieldInput<T> =
  | { changed: false }
  | {
      changed?: true | undefined;
      value: T;
      author?: DesignDocFieldAuthor | undefined;
    }
  | undefined;

/** The value the design writes, or `null` when it leaves the field as it is. */
export function valueOf<T>(
  field: DesignDocFieldInput<T> | undefined,
): T | null {
  return field !== undefined && 'value' in field ? field.value : null;
}

/** Whether the design leaves the field as the model already has it. */
export function isUnchanged(field: DesignDocFieldInput<unknown>): boolean {
  return field === undefined || !('value' in field);
}

/** Whether a human wrote or accepted the value, rather than an agent. */
export function isHumanAuthored(field: DesignDocFieldInput<unknown>): boolean {
  return field !== undefined && 'value' in field && field.author === 'human';
}

/**
 * A field as a form holds it: whether the design writes it, and the value it
 * would write — kept while it is not written, so writing it again picks up
 * where it was.
 */
export interface FieldDraft<T> {
  written: boolean;
  value: T;
}

export function draftOf<T>(
  field: DesignDocFieldInput<T>,
  blank: T,
  written = !isUnchanged(field),
): FieldDraft<T> {
  return { written, value: valueOf(field) ?? blank };
}

/**
 * The field a draft writes, as a human. A value left as it was keeps the
 * author it had, so opening and saving a form claims nothing for the human.
 */
export function fieldFrom<T>(
  draft: FieldDraft<T>,
  original: DesignDocFieldInput<T>,
): DesignDocFieldInput<T> {
  if (!draft.written) return { changed: false };
  if (
    original !== undefined &&
    'value' in original &&
    JSON.stringify(original.value) === JSON.stringify(draft.value)
  ) {
    return original;
  }
  return { changed: true, value: draft.value, author: 'human' };
}

/** Who stands behind a written field; null for one the design leaves alone. */
export function authorOf(
  field: DesignDocFieldInput<unknown>,
): DesignDocFieldAuthor | null {
  if (isUnchanged(field)) return null;
  return isHumanAuthored(field) ? 'human' : 'agent';
}

/**
 * A type reference in words: a building block by its own name, a primitive by
 * the primitive, a collection by its item with `[]` after it.
 */
export function refLabelOf(ref: BuildingBlockRefInput): string {
  if (typeof ref !== 'string') return `${refLabelOf(ref.collectionOf)}[]`;
  return nameOf(ref);
}
