import { IconTrash } from '@tabler/icons-react';
import { ActionIcon } from '#/shared/design-system/action-icon.tsx';
import { Tooltip } from '#/shared/design-system/tooltip.tsx';
import { UNIT_LABEL, type UnitRef } from '../../design-doc-edit.ts';
import { useUnitEditing } from './unit-editing.ts';
import { useWritableUnit } from './writable-unit.ts';

/**
 * Deletes a unit, once the confirmation agrees. Nothing where the document is
 * read only, or for a unit the design removes already.
 */
export function RemoveButton({ unit }: { unit: UnitRef }) {
  const editing = useUnitEditing();
  const writable = useWritableUnit(unit);
  if (editing === null || writable === null) return null;
  return (
    <Tooltip label="Delete" openDelay={300}>
      <ActionIcon
        variant="subtle"
        color="red"
        size="md"
        aria-label={`Delete the ${UNIT_LABEL[unit.kind]} ${unit.id}`}
        onClick={() => editing.remove(unit)}
      >
        <IconTrash size={18} aria-hidden />
      </ActionIcon>
    </Tooltip>
  );
}
