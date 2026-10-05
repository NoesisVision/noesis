import type { OutlineNode } from '#/shared/ui/model-tree/model-outline.ts';
import type { OutlineTree } from '#/shared/ui/model-tree/outline-tree.ts';
import type {
  ArchitectureCheck,
  ArchitectureOutline,
} from '../../architecture-outline.ts';
import { checkPath, needAtPortsPath } from '../../architecture-tree.ts';
import type { LaidOutNode } from './layout-architecture.ts';

/*
 * One selection for both panes. It is a row of the tree, or — for a card no
 * row names, an actor or an adapter say — the card's element under a mark of
 * its own, so the address can hold either.
 */

const ELEMENT_MARK = 'element:';

/** What the address holds for a card no row names. */
export const elementSelection = (id: string) => `${ELEMENT_MARK}${id}`;

export type ArchitectureSubject =
  | { kind: 'group'; path: string }
  | { kind: 'check'; check: ArchitectureCheck }
  | { kind: 'need'; need: ArchitectureOutline['needsAtPorts'][number] }
  | { kind: 'element'; id: string };

/** What is in hand, read from the address: a row of the tree, a card, or nothing. */
export function subjectOf(
  selected: string | null,
  tree: OutlineTree,
  outline: ArchitectureOutline,
): ArchitectureSubject | null {
  if (selected === null) return null;
  if (selected.startsWith(ELEMENT_MARK))
    return { kind: 'element', id: selected.slice(ELEMENT_MARK.length) };
  const row = tree.byPath.get(selected);
  if (row === undefined) return null;
  if (row.elementId !== null) return { kind: 'element', id: row.elementId };
  if (row.kind === 'check') {
    const check = outline.checks.find((one) => checkPath(one) === row.path);
    return check === undefined ? null : { kind: 'check', check };
  }
  if (row.kind === 'need') {
    const need = outline.needsAtPorts.find(
      (one) => needAtPortsPath(one.need.id) === row.path,
    );
    return need === undefined ? null : { kind: 'need', need };
  }
  return { kind: 'group', path: row.path };
}

/** The row a card opens the tree to: the first that names its element, or none. */
export function rowOf(
  tree: OutlineTree,
  elementId: string,
): OutlineNode | null {
  return tree.nodes.find((node) => node.elementId === elementId) ?? null;
}

/** Which cards the selection is, and which it concerns: what the diagram outlines. */
export interface DiagramFocus {
  selected: ReadonlySet<string>;
  related: ReadonlySet<string>;
}

const NOTHING: DiagramFocus = { selected: new Set(), related: new Set() };

export function focusOf(
  subject: ArchitectureSubject | null,
  nodes: readonly LaidOutNode[],
): DiagramFocus {
  if (subject === null) return NOTHING;
  const drawing = (ids: Iterable<string>) => {
    const wanted = new Set(ids);
    return new Set(
      nodes
        .filter(
          ({ id, kind, selects }) =>
            wanted.has(id) || (kind === 'hexagon' && wanted.has(selects)),
        )
        .map(({ id }) => id),
    );
  };
  switch (subject.kind) {
    case 'check':
      return {
        selected: new Set(),
        related: drawing(subject.check.elementIds),
      };
    case 'need':
      return { selected: new Set(), related: drawing(subject.need.ports) };
    case 'group':
      return NOTHING;
    case 'element': {
      const card = nodes.find(
        ({ id, element }) => id === subject.id && element !== null,
      );
      return {
        selected: drawing([subject.id]),
        related: drawing(card?.element?.uses ?? []),
      };
    }
  }
}
