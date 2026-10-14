import type { DesignDocumentInput } from '#backend/app/design-docs/design-doc.ts';
import { writtenIn } from '../../change-set.ts';
import { valueOf } from '../../design-doc-field.ts';
import type { OutlineNode } from './model-outline.ts';

/** How much of the model the tree shows: all of it, or its public face. */
export type OutlineScope = 'all' | 'public';

/**
 * The model as another subsystem meets it: the behaviours the design makes
 * public, the blocks they are on, and the modules down to them. A module
 * with nothing public in it is left out, and so is every other row. Kept in
 * reading order; a behaviour the design leaves alone says nothing of its
 * visibility here, so it is not counted public.
 */
export function publicOutline(
  outline: readonly OutlineNode[],
  doc: DesignDocumentInput,
): OutlineNode[] {
  const isPublic = new Set(
    writtenIn(doc.behaviours)
      .filter((behaviour) => valueOf(behaviour.visibility)?.kind === 'public')
      .map((behaviour) => behaviour.id),
  );
  const byPath = new Map(outline.map((node) => [node.path, node]));
  const kept = new Set<string>();
  for (const node of outline) {
    if (node.kind !== 'behaviour' || node.elementId === null) continue;
    if (!isPublic.has(node.elementId)) continue;
    // The behaviour, and the way down to it.
    for (
      let step: OutlineNode | undefined = node;
      step !== undefined && !kept.has(step.path);
      step = step.parentPath === null ? undefined : byPath.get(step.parentPath)
    )
      kept.add(step.path);
  }
  return outline.filter((node) => kept.has(node.path));
}
