import {
  IconArrowBackUp,
  IconDots,
  IconPencil,
  IconPlus,
  IconTrash,
} from '@tabler/icons-react';
import { ActionIcon } from '#/shared/design-system/action-icon.tsx';
import { Button, type ButtonProps } from '#/shared/design-system/button.tsx';
import { Menu } from '#/shared/design-system/menu.tsx';
import {
  type ElementKind,
  isWritable,
  type PartKind,
  type PartOwner,
  UNIT_LABEL,
  type UnitKind,
  type UnitRef,
  type UnitTarget,
  unitNameOf,
  unitStateOf,
} from '../../design-doc-edit.ts';
import { useUnitEditing } from './unit-editing.ts';

type AddTarget = Extract<UnitTarget, { mode: 'add' }>;

const ADD_LABEL: Record<UnitKind, string> = {
  need: 'Add need',
  module: 'Add submodule',
  building_block: 'Add building block',
  behaviour: 'Add behaviour',
  rule: 'Add rule',
  scenario: 'Add scenario',
  property: 'Add property',
  parameter: 'Add input',
  result: 'Add output',
  implements: 'Add implemented type',
};

const top = (kind: 'need' | ElementKind, parent: string | null): AddTarget => ({
  mode: 'add',
  kind,
  parent,
});

const part = (kind: PartKind, owner: PartOwner): AddTarget => ({
  mode: 'add',
  kind,
  owner,
});

/** What may be added under a unit: elements under an element, parts in it, scenarios in a rule. */
function childTargets(unit: UnitRef): AddTarget[] {
  switch (unit.kind) {
    case 'module': {
      const owner = { kind: 'module', id: unit.id } as const;
      return [
        top('module', unit.id),
        top('building_block', unit.id),
        part('rule', owner),
      ];
    }
    case 'building_block': {
      const owner = { kind: 'building_block', id: unit.id } as const;
      return [
        top('behaviour', unit.id),
        part('property', owner),
        part('rule', owner),
        part('scenario', owner),
        part('implements', owner),
      ];
    }
    case 'behaviour': {
      const owner = { kind: 'behaviour', id: unit.id } as const;
      return [
        part('parameter', owner),
        part('result', owner),
        part('rule', owner),
        part('scenario', owner),
      ];
    }
    case 'rule':
      return 'owner' in unit
        ? [part('scenario', { ...unit.owner, rule: unit.id })]
        : [];
    default:
      return [];
  }
}

/**
 * What a human may do to a unit, behind one button: edit it, add what goes
 * under it, take it out — or, once the design removes it, bring it back.
 * Nothing where the document is read only, or where what the unit hangs
 * under is removed.
 */
export function UnitActions({ unit }: { unit: UnitRef }) {
  const editing = useUnitEditing();
  if (editing === null || !isWritable(editing.document, unit)) return null;
  const removed = unitStateOf(editing.document, unit) === 'removed';
  const name = unitNameOf(editing.document, unit);
  const children = removed ? [] : childTargets(unit);
  return (
    <Menu position="bottom-end" withinPortal>
      <Menu.Target>
        <ActionIcon
          variant="subtle"
          size="sm"
          aria-label={`Edit the ${UNIT_LABEL[unit.kind]} ${name}`}
        >
          <IconDots size={16} aria-hidden />
        </ActionIcon>
      </Menu.Target>
      <Menu.Dropdown>
        {/* An implemented type is all key: there is nothing to edit but which it is. */}
        {!removed && unit.kind !== 'implements' && (
          <Menu.Item
            leftSection={<IconPencil size={14} aria-hidden />}
            onClick={() => editing.write({ mode: 'edit', ref: unit })}
          >
            Edit…
          </Menu.Item>
        )}
        {children.map((target) => (
          <Menu.Item
            key={target.kind}
            leftSection={<IconPlus size={14} aria-hidden />}
            onClick={() => editing.write(target)}
          >
            {`${ADD_LABEL[target.kind]}…`}
          </Menu.Item>
        ))}
        {!removed && <Menu.Divider />}
        {removed ? (
          <Menu.Item
            leftSection={<IconArrowBackUp size={14} aria-hidden />}
            onClick={() => editing.remove(unit)}
          >
            Restore…
          </Menu.Item>
        ) : (
          <Menu.Item
            color="red"
            leftSection={<IconTrash size={14} aria-hidden />}
            onClick={() => editing.remove(unit)}
          >
            Remove…
          </Menu.Item>
        )}
      </Menu.Dropdown>
    </Menu>
  );
}

/** Adds a need, or a module at the top of the design. */
export function AddUnitButton({
  kind,
  ...props
}: { kind: 'need' | 'module' } & Omit<ButtonProps, 'children'>) {
  const editing = useUnitEditing();
  if (editing === null) return null;
  return (
    <Button
      variant="light"
      size="xs"
      leftSection={<IconPlus size={14} aria-hidden />}
      onClick={() => editing.write(top(kind, null))}
      {...props}
    >
      {kind === 'module' ? 'Add module' : ADD_LABEL.need}
    </Button>
  );
}
