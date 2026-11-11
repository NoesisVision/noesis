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
import { DiagramSection } from './sections/diagram-section.tsx';

export const moduleSections = (
  module: DesignedDomainModuleInput,
  tree: OutlineTree,
  doc: DesignDocumentInput,
): ReactElement[] => {
  const element: ElementRef = { collection: 'modules', id: module.id };
  // Only the rules of the module the design names no behavior for.
  const rules = ruleItems(doc, module.id);
  return [
    ...childSections(element, 'module', module.id, tree, doc),
    ...(rules.length === 0
      ? []
      : section(ChangeListSection, 'rules', {
          element,
          title: 'Rules',
          kind: 'rule',
          items: rules,
        })),
    ...section(DiagramSection, 'diagram', {
      element,
      field: module.diagram,
    }),
  ];
};
