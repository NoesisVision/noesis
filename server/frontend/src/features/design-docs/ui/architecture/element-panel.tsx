import { useMemo } from 'react';
import { outlineTree } from '#/features/design-docs/ui/model-tree/outline-tree.ts';
import type { DesignDocumentInput } from '#backend/app/design-docs/design-doc.ts';
import { outlineOf } from '../../design-doc-outline.ts';
import { DetailsPanel } from './details-panel.tsx';
import { ElementBody } from './element-body.tsx';

/**
 * One element of a model read on a canvas, as the architecture's panel reads
 * one: what it is and its name — where it sits the canvas shows, drawn
 * inside what holds it — then its body as the model reads it. A model read
 * as it stands has nothing in it that is a change; a design, marked, says
 * what it does to each element.
 */
export function ElementPanel({
  id,
  document,
  eyebrow,
  title,
  onSelectElement,
  onMinimize,
  marked = false,
}: {
  id: string;
  document: DesignDocumentInput;
  /** Whether what the document does to each element is said; a model read as it stands says nothing. */
  marked?: boolean;
  eyebrow: string;
  title: string;
  onSelectElement: (id: string) => void;
  /** Shrinks the panel out of the way; without it there is no such button. */
  onMinimize?: () => void;
}) {
  const modelTree = useMemo(
    () =>
      outlineTree(
        marked
          ? outlineOf(document)
          : outlineOf(document).map((node) => ({
              ...node,
              change: 'unchanged' as const,
            })),
      ),
    [document, marked],
  );
  return (
    <DetailsPanel
      document={document}
      modelTree={modelTree}
      onSelectElement={onSelectElement}
      onMinimize={onMinimize}
      glance
      eyebrow={eyebrow}
      title={title}
      change={modelTree.byPath.get(id)?.change}
    >
      <ElementBody id={id} document={document} modelTree={modelTree} />
    </DetailsPanel>
  );
}
