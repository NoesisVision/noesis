import type { ReactElement } from 'react';
import type { OutlineTree } from '#/features/design-docs/ui/model-tree/outline-tree.ts';
import type {
  DesignDocumentInput,
  DesignedDomainModuleInput,
} from '#backend/app/design-docs/design-doc.ts';
import { ruleItems } from '../change-list-items.ts';
import type { ElementRef } from '../element-ref.ts';
import { childSections } from './child-sections.tsx';
import { section } from './section.ts';
import { ChangeListSection } from './sections/change-list-section.tsx';
import { DescriptionSection } from './sections/description-section.tsx';
import { DiagramSection } from './sections/diagram-section.tsx';

export const moduleSections = (
  module: DesignedDomainModuleInput,
  tree: OutlineTree,
  doc: DesignDocumentInput,
): ReactElement[] => {
  const element: ElementRef = { collection: 'modules', id: module.id };
  return [
    ...childSections(element, 'module', module.id, tree, doc),
    ...section(ChangeListSection, 'rules', {
      element,
      title: 'Rules',
      kind: 'rule',
      items: ruleItems(module.id, module.rules, doc.needs),
    }),
    ...section(DiagramSection, 'diagram', {
      element,
      field: module.diagram,
    }),
    ...section(DescriptionSection, 'definition', {
      element,
      title: 'Definition',
      field: module.definition,
    }),
  ];
};
