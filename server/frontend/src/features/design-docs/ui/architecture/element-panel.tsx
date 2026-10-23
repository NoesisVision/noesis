import { useMemo } from 'react';
import { outlineTree } from '#/features/design-docs/ui/model-tree/outline-tree.ts';
import type { DesignDocumentInput } from '#backend/app/design-docs/design-doc.ts';
import { outlineOf } from '../../design-doc-outline.ts';
import { DetailsPanel } from './details-panel.tsx';
import { ElementBody } from './element-body.tsx';

/**
 * One element of a model read on a canvas, as the architecture's panel reads
 * one: what it is, its name and address, then its body as the model reads
 * it. For a model read as it stands, so nothing in it is a change.
 */
export function ElementPanel({
  id,
  document,
  eyebrow,
  title,
  onSelectElement,
  onClear,
  onMinimize,
}: {
  id: string;
  document: DesignDocumentInput;
  eyebrow: string;
  title: string;
  onSelectElement: (id: string) => void;
  /** Clears the selection; without it the panel has no close button. */
  onClear?: () => void;
  /** Shrinks the panel out of the way; without it there is no such button. */
  onMinimize?: () => void;
}) {
  const modelTree = useMemo(
    () =>
      outlineTree(
        outlineOf(document).map((node) => ({
          ...node,
          change: 'unchanged' as const,
        })),
      ),
    [document],
  );
  return (
    <DetailsPanel
      document={document}
      modelTree={modelTree}
      onSelectElement={onSelectElement}
      onClear={onClear}
      onMinimize={onMinimize}
      glance
      eyebrow={eyebrow}
      title={title}
      address={id}
    >
      <ElementBody id={id} document={document} modelTree={modelTree} />
    </DetailsPanel>
  );
}
