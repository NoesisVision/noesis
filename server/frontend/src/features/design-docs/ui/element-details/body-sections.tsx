import type { ReactElement } from 'react';
import type { OutlineNode } from '#/shared/ui/model-tree/model-outline.ts';
import type { OutlineTree } from '#/shared/ui/model-tree/outline-tree.ts';
import type { DesignDocumentInput } from '#backend/app/design-docs/design-doc.ts';
import { behaviourSections } from './behaviour-sections.tsx';
import { buildingBlockSections } from './building-block-sections.tsx';
import { findById } from './change-set.ts';
import { childSections } from './child-sections.tsx';
import type { ElementRef } from './element-ref.ts';
import { moduleSections } from './module-sections.tsx';
import { partSections } from './part-sections.tsx';
import { section } from './section.ts';
import { NoteSection } from './sections/note-section.tsx';

/**
 * What the document says about one element, as the sections that say it. The
 * sections draw; this only picks them, so a section can change how it reads
 * — or become editable — without the element knowing.
 */
export const bodySections = (
  node: OutlineNode,
  doc: DesignDocumentInput,
  /** The tree beside the panel, which says what changed under an element. */
  tree: OutlineTree,
): ReactElement[] => {
  if (node.change === 'removed') {
    return [
      ...section(NoteSection, 'removed', {
        children: 'This design removes it.',
      }),
      // The document names only the element; whatever went with it is still
      // a row in the tree, and worth listing.
      ...sectionsUnder(node, tree),
    ];
  }
  if (node.elementId === null) return partSections(node, doc);
  const module = findById(doc.modules, node.elementId);
  if (module) return moduleSections(module, tree);
  const block = findById(doc.buildingBlocks, node.elementId);
  if (block) return buildingBlockSections(block, tree);
  const behaviour = findById(doc.behaviours, node.elementId);
  if (behaviour) return behaviourSections(behaviour);
  // Named by no change set, the element is only here for what is under it,
  // which is then all there is to list.
  return [
    ...section(NoteSection, 'unchanged', {
      children:
        'This design does not change it; it is here because the elements under it are.',
    }),
    ...sectionsUnder(node, tree),
  ];
};

/**
 * What is listed under an element the document says nothing more about — one
 * it only removes, or one it never names — read off the tree alone. A part
 * has no rows of its own kinds to list.
 */
const sectionsUnder = (
  node: OutlineNode,
  tree: OutlineTree,
): ReactElement[] => {
  if (node.elementId === null) return [];
  const element: ElementRef = {
    collection:
      node.kind === 'module'
        ? 'modules'
        : node.kind === 'behaviour'
          ? 'behaviours'
          : 'buildingBlocks',
    id: node.elementId,
  };
  return childSections(element, node.kind, node.path, tree);
};
