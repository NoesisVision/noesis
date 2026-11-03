import type { ReactElement } from 'react';
import type { OutlineTree } from '#/features/design-docs/ui/model-tree/outline-tree.ts';
import type {
  DesignDocumentInput,
  DesignedBuildingBlockInput,
} from '#backend/app/design-docs/design-doc.ts';
import {
  collaboratorItems,
  propertyItems,
  ruleItems,
} from '../change-list-items.ts';
import type { ElementRef } from '../element-ref.ts';
import { childSections } from './child-sections.tsx';
import { section } from './section.ts';
import { ChangeListSection } from './sections/change-list-section.tsx';
import { DiagramSection } from './sections/diagram-section.tsx';

export const buildingBlockSections = (
  block: DesignedBuildingBlockInput,
  tree: OutlineTree,
  doc: DesignDocumentInput,
): ReactElement[] => {
  const element: ElementRef = { collection: 'buildingBlocks', id: block.id };
  return [
    // What it does reads before what it holds.
    ...childSections(element, 'building_block', block.id, tree, doc),
    ...section(ChangeListSection, 'rules', {
      element,
      title: 'Rules',
      kind: 'rule',
      items: ruleItems(block.id, block.rules, doc.needs),
    }),
    ...section(ChangeListSection, 'properties', {
      element,
      title: 'Properties',
      kind: 'property',
      items: propertyItems(doc, block.id),
    }),
    ...section(ChangeListSection, 'collaborators', {
      element,
      title: 'Collaborators',
      kind: 'collaborator',
      items: collaboratorItems(doc, block.id),
    }),
    ...section(DiagramSection, 'diagram', {
      element,
      field: block.diagram,
    }),
  ];
};
