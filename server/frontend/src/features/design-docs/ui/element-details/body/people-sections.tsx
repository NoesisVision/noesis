import type { ReactElement } from 'react';
import type {
  DesignDocumentInput,
  DesignedManualProcessInput,
} from '#backend/app/design-docs/design-doc.ts';
import { stepItems } from '../change-list-items.ts';
import type { ElementRef } from '../element-ref.ts';
import { section } from './section.ts';
import { ChangeListSection } from './sections/change-list-section.tsx';

/** A manual process: the behaviors it invokes, in the order it calls them. */
export const manualProcessSections = (
  process: DesignedManualProcessInput,
  doc: DesignDocumentInput,
): ReactElement[] => {
  const element: ElementRef = { collection: 'manualProcesses', id: process.id };
  return section(ChangeListSection, 'steps', {
    element,
    title: 'Steps',
    kind: 'behavior',
    items: stepItems(doc, process.id),
  });
};
