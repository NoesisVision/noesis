import { useMemo } from 'react';
import type { OutlineTree } from '#/shared/ui/model-tree/outline-tree.ts';
import type { DesignDocumentInput } from '#backend/app/design-docs/design-doc.ts';
import { bodySections } from '../element-details/body/body-sections.tsx';
import { DesignDocumentContext } from '../element-details/design-document-context.ts';
import { ElementNavigationContext } from '../element-details/element-navigation.ts';
import classes from './architecture-details.module.css';

/** The element as the model reads it, below what the architecture finds. */
export function ElementBody({
  id,
  document: doc,
  modelTree,
  onSelectElement,
}: {
  id: string;
  document: DesignDocumentInput;
  /** The model's own tree, which the body sections read through. */
  modelTree: OutlineTree;
  onSelectElement: (id: string) => void;
}) {
  const navigation = useMemo(
    () => ({
      has: (path: string) => modelTree.byPath.has(path),
      select: onSelectElement,
    }),
    [modelTree, onSelectElement],
  );
  const node = modelTree.byPath.get(id);
  if (node === undefined) return null;
  return (
    <DesignDocumentContext.Provider value={doc}>
      <ElementNavigationContext.Provider value={navigation}>
        <div className={classes.sections}>
          {bodySections(node, doc, modelTree)}
        </div>
      </ElementNavigationContext.Provider>
    </DesignDocumentContext.Provider>
  );
}
