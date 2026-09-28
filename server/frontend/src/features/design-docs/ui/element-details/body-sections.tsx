import type { ReactElement } from 'react';
import type { OutlineNode } from '#/shared/ui/model-tree/model-outline.ts';
import type { DesignDocumentInput } from '#backend/app/design-docs/design-doc.ts';
import { behaviourSections } from './behaviour-sections.tsx';
import { buildingBlockSections } from './building-block-sections.tsx';
import { findById } from './change-set.ts';
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
): ReactElement[] => {
  if (node.change === 'removed') {
    return section(NoteSection, 'removed', {
      children: 'This design removes it. Nothing else is said.',
    });
  }
  if (node.elementId === null) return partSections(node, doc);
  const module = findById(doc.modules, node.elementId);
  console.info('module', module);
  if (module) return moduleSections(module);
  const block = findById(doc.buildingBlocks, node.elementId);
  console.info('block', block);
  if (block) return buildingBlockSections(block);
  const behaviour = findById(doc.behaviours, node.elementId);
  console.info('behaviour', behaviour);
  if (behaviour) return behaviourSections(behaviour);
  return section(NoteSection, 'unchanged', {
    children:
      'This design does not change it; it is here because the elements under it are.',
  });
};
