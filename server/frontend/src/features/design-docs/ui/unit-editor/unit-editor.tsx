import { type ReactNode, useMemo, useState } from 'react';
import type { DesignDocumentInput } from '#backend/app/design-docs/design-doc.ts';
import type { UnitRef, UnitTarget } from '../../design-doc-edit.ts';
import { ConfirmRemovalModal } from './confirm-removal-modal.tsx';
import { type UnitEditing, UnitEditingContext } from './unit-editing.ts';
import { UnitEditorModal } from './unit-editor-modal.tsx';

/**
 * Lets everything under it edit the document: a unit opened for writing, or
 * for taking out, is held here and drawn once. Each opening mounts its modal
 * afresh, so a form never carries what was typed into another unit.
 */
export function UnitEditor({
  changeId,
  docId,
  document,
  children,
}: {
  changeId: string;
  docId: string;
  document: DesignDocumentInput;
  children: ReactNode;
}) {
  const [writing, setWriting] = useState<UnitTarget | null>(null);
  const [removing, setRemoving] = useState<UnitRef | null>(null);
  const editing = useMemo<UnitEditing>(
    () => ({
      document,
      write: setWriting,
      remove: setRemoving,
    }),
    [document],
  );
  const saving = { changeId, docId, document };
  return (
    <UnitEditingContext.Provider value={editing}>
      {children}
      {writing !== null && (
        <UnitEditorModal
          {...saving}
          target={writing}
          onClose={() => setWriting(null)}
        />
      )}
      {removing !== null && (
        <ConfirmRemovalModal
          {...saving}
          unit={removing}
          onClose={() => setRemoving(null)}
        />
      )}
    </UnitEditingContext.Provider>
  );
}
