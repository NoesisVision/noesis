import {
  addressOf,
  childIdOf,
  isBuildingBlock,
  isWithin,
  nameOf,
  parentOf,
  prefixOf,
} from '#/shared/model/element-id.ts';
import type { DesignDocumentInput } from '#backend/app/design-docs/design-doc.ts';
import { keysOf, topSetOf, unitStateOf } from './design-doc-change-sets.ts';
import {
  ELEMENT_KINDS,
  type ElementKind,
  type UnitRef,
} from './design-doc-unit.ts';

/*
 * Moving an element the design adds to another parent, and the parents it
 * may move to.
 */

/**
 * Whether an element may move: only one the design adds. One the model has
 * would have to be removed and added again, and the design does not hold
 * what the model says of it.
 */
export const canMove = (doc: DesignDocumentInput, ref: UnitRef): boolean =>
  (ref.kind === 'module' ||
    ref.kind === 'building_block' ||
    ref.kind === 'behavior') &&
  unitStateOf(doc, ref) === 'added';

/** The id an element takes under another parent: its name stays, its place changes. */
export const movedIdOf = (ref: UnitRef, to: string | null): string =>
  childIdOf(ref.kind as ElementKind, to, nameOf(ref.id));

/**
 * Where an element may go: a module or a building block into any module the
 * design names or stands in, a module to the top as well, a behavior into
 * any building block. Never into itself, nowhere the design removes, not
 * where it already is, and not where one of its name already stands.
 */
export function moveDestinationsOf(
  doc: DesignDocumentInput,
  ref: UnitRef,
): (string | null)[] {
  if (!canMove(doc, ref)) return [];
  const parentKind = ref.kind === 'behavior' ? 'building_block' : 'module';
  const candidates: (string | null)[] = [
    ...(ref.kind === 'module' ? [null] : []),
    ...parentsNamedIn(doc, parentKind),
  ];
  const here = parentOf(ref.id);
  return candidates.filter(
    (to) =>
      to !== here &&
      (to === null || !isWithin(to, ref.id)) &&
      (to === null ||
        unitStateOf(doc, { kind: parentKind, id: to }) !== 'removed') &&
      unitStateOf(doc, {
        kind: ref.kind as ElementKind,
        id: movedIdOf(ref, to),
      }) === 'unchanged',
  );
}

/** Every module, or every building block, the document names or that holds something it names. */
function parentsNamedIn(
  doc: DesignDocumentInput,
  kind: 'module' | 'building_block',
): string[] {
  const found = new Set<string>();
  const prefix = prefixOf(kind);
  const take = (id: string) => {
    for (let at: string | null = id; at !== null; at = parentOf(at))
      if (at.startsWith(prefix)) found.add(at);
  };
  for (const elementKind of ELEMENT_KINDS)
    keysOf(topSetOf(doc, elementKind)).forEach(take);
  if (kind === 'building_block') blocksNamedIn(doc).forEach(take);
  return [...found].sort((a, b) => addressOf(a).localeCompare(addressOf(b)));
}

/** Every building block the document names anywhere, for a type to be chosen from. */
export function blocksNamedIn(doc: DesignDocumentInput): string[] {
  const found = new Set<string>();
  const walk = (node: unknown): void => {
    if (typeof node === 'string') {
      if (isBuildingBlock(node)) found.add(node);
    } else if (Array.isArray(node)) node.forEach(walk);
    else if (typeof node === 'object' && node !== null)
      Object.values(node).forEach(walk);
  };
  walk(doc);
  return [...found].sort((a, b) => addressOf(a).localeCompare(addressOf(b)));
}

// --- Drafts: a unit as its form holds it ---
