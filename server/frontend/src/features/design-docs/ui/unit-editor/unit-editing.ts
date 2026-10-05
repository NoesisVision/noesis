import { createContext, useContext } from 'react';
import type { DesignDocumentInput } from '#backend/app/design-docs/design-doc.ts';
import type { UnitRef, UnitTarget } from '../../design-doc-edit.ts';

/**
 * Opens the editor on a unit from anywhere under the document: one editor
 * and one confirmation per document, however many places ask for them.
 */
export interface UnitEditing {
  document: DesignDocumentInput;
  /** Opens the form on a new unit, or on one to revise. */
  write: (target: UnitTarget) => void;
  /** Asks before the unit leaves the design, or comes back to it. */
  remove: (ref: UnitRef) => void;
}

export const UnitEditingContext = createContext<UnitEditing | null>(null);

/** Null where nothing may be edited: the document is read only there. */
export const useUnitEditing = () => useContext(UnitEditingContext);
