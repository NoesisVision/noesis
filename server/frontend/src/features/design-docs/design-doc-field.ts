import type { DesignDocFieldAuthor } from '#backend/app/design-docs/design-doc-field.ts';
import type { BuildingBlockRefInput } from '#backend/app/system-model/system-model.ts';

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
export function valueOf<T>(field: DesignDocFieldInput<T>): T | null {
  return field !== undefined && 'value' in field ? field.value : null;
}

/** Whether a human wrote or accepted the value, rather than an agent. */
export function isHumanAuthored(field: DesignDocFieldInput<unknown>): boolean {
  return field !== undefined && 'value' in field && field.author === 'human';
}

/**
 * A type reference in words: a building block by its own name, a primitive by
 * the primitive, a collection by its item with `[]` after it.
 */
export function refLabelOf(ref: BuildingBlockRefInput): string {
  if (typeof ref !== 'string') return `${refLabelOf(ref.collectionOf)}[]`;
  const address = ref.slice(ref.indexOf('|') + 1);
  return address.split('.').at(-1) ?? address;
}
