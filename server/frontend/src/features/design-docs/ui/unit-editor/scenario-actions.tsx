import { IconPencil } from '@tabler/icons-react';
import { ActionIcon } from '#/shared/design-system/action-icon.tsx';
import { Group } from '#/shared/design-system/group.tsx';
import { Tooltip } from '#/shared/design-system/tooltip.tsx';
import type { UnitRef } from '../../design-doc-edit.ts';
import { RemoveButton } from './remove-button.tsx';
import { useUnitEditing } from './unit-editing.ts';
import { useWritableUnit } from './writable-unit.ts';

/**
 * A scenario's own buttons: Edit opens the form on it, Delete asks first.
 * Nothing where the document is read only, or for a scenario the design
 * removes.
 */
export function ScenarioActions({ scenario }: { scenario: UnitRef }) {
  const editing = useUnitEditing();
  const writable = useWritableUnit(scenario);
  if (editing === null || writable === null) return null;
  return (
    <Group gap={2} wrap="nowrap">
      <Tooltip label="Edit" openDelay={300}>
        <ActionIcon
          variant="subtle"
          size="md"
          aria-label={`Edit the scenario ${scenario.id}`}
          onClick={() => editing.write({ mode: 'edit', ref: scenario })}
        >
          <IconPencil size={18} aria-hidden />
        </ActionIcon>
      </Tooltip>
      <RemoveButton unit={scenario} />
    </Group>
  );
}
