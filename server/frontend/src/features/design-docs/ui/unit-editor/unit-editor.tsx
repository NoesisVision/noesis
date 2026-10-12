import { type ReactNode, useCallback, useMemo, useState } from 'react';
import { describeFailure } from '#/shared/api/failure.ts';
import type { DesignDocumentInput } from '#backend/app/design-docs/design-doc.ts';
import {
  type DesignDocEdit,
  type InlineFields,
  inlineEditOf,
  type UnitRef,
  type UnitTarget,
  violationsInWords,
} from '../../design-doc-edit.ts';
import { useDesignDocEdit, violationsIn } from '../../design-docs.api.ts';
import { ConfirmRemovalModal } from './confirm-removal-modal.tsx';
import { MoveModal } from './move-modal.tsx';
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
  onMoved,
  children,
}: {
  changeId: string;
  docId: string;
  document: DesignDocumentInput;
  /** Follows an element to where it moved, its id there given. */
  onMoved?: (id: string) => void;
  children: ReactNode;
}) {
  const [writing, setWriting] = useState<UnitTarget | null>(null);
  const [removing, setRemoving] = useState<UnitRef | null>(null);
  const [moving, setMoving] = useState<{
    unit: UnitRef;
    to?: string | null;
  } | null>(null);
  const save = useDesignDocEdit(changeId, docId);
  const { mutateAsync } = save;
  const apply = useCallback(
    async (edit: DesignDocEdit) => {
      try {
        await mutateAsync(edit);
        return null;
      } catch (error) {
        const violations = violationsIn(error);
        return violations === null
          ? describeFailure(error).description
          : violationsInWords(violations).join(' ');
      }
    },
    [mutateAsync],
  );
  const saveFields = useCallback(
    async (ref: UnitRef, fields: InlineFields) => {
      const inline = inlineEditOf(document, ref, fields);
      if ('error' in inline) return inline.error;
      const problem = await apply(inline.edit);
      // An added element renamed has moved: the page follows it.
      if (problem === null && inline.id !== ref.id && !('owner' in ref))
        onMoved?.(inline.id);
      return problem;
    },
    [document, apply, onMoved],
  );
  const editing = useMemo<UnitEditing>(
    () => ({
      document,
      write: setWriting,
      remove: setRemoving,
      move: (unit, to) => setMoving(to === undefined ? { unit } : { unit, to }),
      saveFields,
      apply,
    }),
    [document, saveFields, apply],
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
      {moving !== null && (
        <MoveModal
          {...saving}
          {...moving}
          onClose={() => setMoving(null)}
          onMoved={onMoved}
        />
      )}
    </UnitEditingContext.Provider>
  );
}
