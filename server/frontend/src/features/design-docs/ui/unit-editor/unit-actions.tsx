import {
  IconArrowBackUp,
  IconArrowsMove,
  IconDots,
  IconPencil,
  IconPlus,
  IconTrash,
} from '@tabler/icons-react';
import { cloneElement, type ReactElement, useCallback, useState } from 'react';
import { ActionIcon } from '#/shared/design-system/action-icon.tsx';
import { Button, type ButtonProps } from '#/shared/design-system/button.tsx';
import { Menu } from '#/shared/design-system/menu.tsx';
import { Tooltip } from '#/shared/design-system/tooltip.tsx';
import {
  canMove,
  type ElementKind,
  isWritable,
  moveDestinationsOf,
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
import classes from './unit-actions.module.css';

type AddTarget = Extract<UnitTarget, { mode: 'add' }>;

const DEFAULT_BUTTON_VARIANT: ButtonProps['variant'] = 'outline';

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
 *
 * On a card the menu opens on a right-click (`UnitContextMenu`), so the
 * button is for the keyboard alone: out of sight until it has focus.
 */
export function UnitActions({
  unit,
  keyboardOnly = false,
}: {
  unit: UnitRef;
  keyboardOnly?: boolean;
}) {
  const editing = useUnitEditing();
  if (editing === null || !isWritable(editing.document, unit)) return null;
  const name = unitNameOf(editing.document, unit);
  const menu = (
    <Menu position="bottom-end" withinPortal>
      <Menu.Target>
        <ActionIcon
          variant={DEFAULT_BUTTON_VARIANT}
          size="md"
          aria-label={`Edit the ${UNIT_LABEL[unit.kind]} ${name}`}
        >
          <IconDots size={20} aria-hidden />
        </ActionIcon>
      </Menu.Target>
      <Menu.Dropdown>
        <UnitMenuItems unit={unit} />
      </Menu.Dropdown>
    </Menu>
  );
  return keyboardOnly ? (
    <span className={classes.keyboardOnly}>{menu}</span>
  ) : (
    menu
  );
}

/**
 * A card whose menu opens where it is right-clicked, or long-pressed on a
 * touch screen. `children` is the card: one element, which takes the
 * handlers — a component in between has to pass them on to it.
 */
export function UnitContextMenu({
  unit,
  children,
}: {
  unit: UnitRef;
  children: ReactElement;
}) {
  const editing = useUnitEditing();
  const [opened, setOpened] = useState(false);
  const close = useCallback(() => setOpened(false), []);
  const onChange = useCallback(
    (next: boolean) => {
      if (next) showOnly(close);
      setOpened(next);
    },
    [close],
  );
  if (editing === null || !isWritable(editing.document, unit)) return children;
  return (
    <Menu withinPortal shadow="md" opened={opened} onChange={onChange}>
      <Menu.ContextMenu>
        {/* What a card's stylesheet answers the pointer on: only a card with a menu does. */}
        {cloneElement(children as ReactElement<Record<string, unknown>>, {
          'data-context-menu': true,
        })}
      </Menu.ContextMenu>
      <Menu.Dropdown>
        <UnitMenuItems unit={unit} />
      </Menu.Dropdown>
    </Menu>
  );
}

/*
 * One card's menu open at a time. A right-click keeps its press from the
 * page, so another card's open menu never hears of it as a click outside;
 * each one opening closes the one before it instead — and the same card
 * right-clicked again just moves its menu to the pointer.
 */
let closeOpenMenu: (() => void) | null = null;

function showOnly(close: () => void) {
  if (closeOpenMenu !== close) closeOpenMenu?.();
  closeOpenMenu = close;
}

/** The items of a unit's menu, wherever it opens. */
function UnitMenuItems({ unit }: { unit: UnitRef }) {
  const editing = useUnitEditing();
  if (editing === null) return null;
  const removed = unitStateOf(editing.document, unit) === 'removed';
  const children = removed ? [] : childTargets(unit);
  return (
    <>
      {/* An implemented type is all key: there is nothing to edit but which it is. */}
      {!removed && unit.kind !== 'implements' && (
        <Menu.Item
          leftSection={<IconPencil size={14} aria-hidden />}
          onClick={() => editing.write({ mode: 'edit', ref: unit })}
        >
          Edit…
        </Menu.Item>
      )}
      {canMove(editing.document, unit) &&
        moveDestinationsOf(editing.document, unit).length > 0 && (
          <Menu.Item
            leftSection={<IconArrowsMove size={14} aria-hidden />}
            onClick={() => editing.move(unit)}
          >
            Move to…
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
    </>
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
      variant={DEFAULT_BUTTON_VARIANT}
      size="xs"
      leftSection={<IconPlus size={14} aria-hidden />}
      onClick={() => editing.write(top(kind, null))}
      {...props}
    >
      {kind === 'module' ? 'Add module' : ADD_LABEL.need}
    </Button>
  );
}

/**
 * Adds one more of what a section lists — a rule, a scenario, an input —
 * from its header. Nothing where the document is read only, or where what
 * the new unit would go into is removed.
 */
export function AddButton({ target }: { target: AddTarget }) {
  const editing = useUnitEditing();
  if (editing === null || isRemoved(editing.document, target)) return null;
  const label = ADD_LABEL[target.kind];
  return (
    <Tooltip label={label} openDelay={300}>
      <ActionIcon
        variant={DEFAULT_BUTTON_VARIANT}
        size="md"
        aria-label={label}
        onClick={() => editing.write(target)}
      >
        <IconPlus size={20} aria-hidden />
      </ActionIcon>
    </Tooltip>
  );
}

/**
 * Opens the editor on the unit a single-field section shows — its diagram,
 * its definition — from the section's header.
 */
export function EditButton({ unit, field }: { unit: UnitRef; field: string }) {
  const editing = useUnitEditing();
  if (
    editing === null ||
    !isWritable(editing.document, unit) ||
    unitStateOf(editing.document, unit) === 'removed'
  )
    return null;
  const label = `Edit the ${field.toLowerCase()}`;
  return (
    <Tooltip label={label} openDelay={300}>
      <ActionIcon
        variant={DEFAULT_BUTTON_VARIANT}
        size="md"
        aria-label={label}
        onClick={() => editing.write({ mode: 'edit', ref: unit })}
      >
        <IconPencil size={20} aria-hidden />
      </ActionIcon>
    </Tooltip>
  );
}

/** Whether what a new unit would go into is one the design removes. */
function isRemoved(
  doc: Parameters<typeof unitStateOf>[0],
  target: AddTarget,
): boolean {
  const into: UnitRef | null =
    'owner' in target
      ? target.owner.rule === undefined
        ? { kind: target.owner.kind, id: target.owner.id }
        : {
            kind: 'rule',
            id: target.owner.rule,
            owner: { kind: target.owner.kind, id: target.owner.id },
          }
      : target.parent === null
        ? null
        : {
            kind: target.kind === 'behaviour' ? 'building_block' : 'module',
            id: target.parent,
          };
  return (
    into !== null &&
    (unitStateOf(doc, into) === 'removed' || !isWritable(doc, into))
  );
}

/** Where a new unit of a kind goes under an owner: a part in it, or an element below it. */
export const addTargetOf = (kind: UnitKind, owner: PartOwner): AddTarget =>
  kind === 'need' ||
  kind === 'module' ||
  kind === 'building_block' ||
  kind === 'behaviour'
    ? top(kind, owner.id)
    : part(kind, owner);

/**
 * Takes one unit out with a single small icon, where a whole menu would
 * crowd a line of prose — an implemented type in "implements A, B". It asks
 * first, as every removal does; nothing for a unit the design already
 * removes.
 */
export function RemoveButton({
  unit,
  className,
}: {
  unit: UnitRef;
  /** How the line it stands in shows it: on hover, say. */
  className?: string;
}) {
  const editing = useUnitEditing();
  if (
    editing === null ||
    !isWritable(editing.document, unit) ||
    unitStateOf(editing.document, unit) === 'removed'
  )
    return null;
  const label = `Remove the ${UNIT_LABEL[unit.kind]} ${unitNameOf(editing.document, unit)}`;
  return (
    <Tooltip label="Remove" openDelay={300}>
      <ActionIcon
        variant="subtle"
        color="red"
        size="xs"
        className={className}
        aria-label={label}
        onClick={() => editing.remove(unit)}
      >
        <IconTrash size={12} aria-hidden />
      </ActionIcon>
    </Tooltip>
  );
}
