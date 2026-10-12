import {
  type InlineFields,
  isWritable,
  type Unit,
  type UnitRef,
  type UnitState,
  unitOf,
  unitStateOf,
} from '../../design-doc-edit.ts';
import { useUnitEditing } from './unit-editing.ts';

export interface WritableUnit {
  state: UnitState;
  /** What the design writes for it now; null for one it leaves alone. */
  unit: Unit | null;
  save: (fields: InlineFields) => Promise<string | null>;
}

/**
 * A unit that may be written in place: null where the document is read only,
 * for no unit at all, and for one the design removes or that hangs under one
 * it removes.
 */
export function useWritableUnit(ref: UnitRef | null): WritableUnit | null {
  const editing = useUnitEditing();
  if (editing === null || ref === null) return null;
  const { document: doc, saveFields } = editing;
  const state = unitStateOf(doc, ref);
  if (state === 'removed' || !isWritable(doc, ref)) return null;
  return {
    state,
    unit: unitOf(doc, ref),
    save: (fields) => saveFields(ref, fields),
  };
}
