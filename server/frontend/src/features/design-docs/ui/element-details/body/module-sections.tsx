import type { ReactElement } from 'react';
import type { OutlineTree } from '#/shared/ui/model-tree/outline-tree.ts';
import type {
  DesignDocumentInput,
  DesignedDomainModuleInput,
} from '#backend/app/design-docs/design-doc.ts';
import type { ElementRef } from '../element-ref.ts';
import { childSections } from './child-sections.tsx';
import { section } from './section.ts';
import { DescriptionSection } from './sections/description-section.tsx';

export const moduleSections = (
  module: DesignedDomainModuleInput,
  tree: OutlineTree,
  doc: DesignDocumentInput,
): ReactElement[] => {
  const element: ElementRef = { collection: 'modules', id: module.id };
  return [
    ...childSections(element, 'module', module.id, tree, doc),
    ...section(DescriptionSection, 'description', {
      element,
      field: module.description,
    }),
  ];
};
