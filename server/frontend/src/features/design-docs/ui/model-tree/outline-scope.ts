import type { DesignDocumentInput } from '#backend/app/design-docs/design-doc.ts';
import { writtenIn } from '../../change-set.ts';
import { valueOf } from '../../design-doc-field.ts';
import { ownerOf } from '../../element-id.ts';
import type { OutlineNode } from './model-outline.ts';

/** How much of the model the tree shows: all of it, or the face it turns outward. */
export type OutlineScope = 'all' | 'public';

/**
 * The model as another subsystem meets it: the behaviors of the blocks the
 * design makes application services or in adapters — its driving ports —
 * those blocks, and the modules down to them. A module with no driving port
 * in it is left out, and so is every other row. Kept in reading order; a
 * block whose type the design leaves alone says nothing of what it is here,
 * so its behaviors are not counted.
 */
export function publicOutline(
  outline: readonly OutlineNode[],
  doc: DesignDocumentInput,
): OutlineNode[] {
  const driving = new Set(
    writtenIn(doc.buildingBlocks)
      .filter((block) => {
        const type = valueOf(block.type);
        return type === 'application_service' || type === 'in_adapter';
      })
      .map((block) => block.id),
  );
  const isPublic = new Set(
    writtenIn(doc.behaviors)
      .filter((behavior) => driving.has(ownerOf(behavior.id)))
      .map((behavior) => behavior.id),
  );
  const byPath = new Map(outline.map((node) => [node.path, node]));
  const kept = new Set<string>();
  for (const node of outline) {
    if (node.kind !== 'behavior' || node.elementId === null) continue;
    if (!isPublic.has(node.elementId)) continue;
    // The behavior, and the way down to it.
    for (
      let step: OutlineNode | undefined = node;
      step !== undefined && !kept.has(step.path);
      step = step.parentPath === null ? undefined : byPath.get(step.parentPath)
    )
      kept.add(step.path);
  }
  return outline.filter((node) => kept.has(node.path));
}
