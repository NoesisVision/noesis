import type { ReactElement } from 'react';
import type { DesignedRuleInput } from '#backend/app/design-docs/design-doc.ts';
import { partPathOf } from '../../design-doc-outline.ts';
import { partItems } from './change-list-items.ts';
import type { ElementRef, OwnerRef } from './element-ref.ts';
import { section } from './section.ts';
import { ChangeListSection } from './sections/change-list-section.tsx';
import { DescriptionSection } from './sections/description-section.tsx';

export const ruleSections = (
  owner: OwnerRef,
  rule: DesignedRuleInput,
): ReactElement[] => {
  const element: ElementRef = { owner, part: 'rules', name: rule.name };
  // A rule's own scenarios hang under the rule in the tree, not its owner.
  const rulePath = partPathOf(owner.id, 'rule', rule.name);
  return [
    ...section(DescriptionSection, 'description', {
      element,
      field: rule.description,
    }),
    ...section(ChangeListSection, 'scenarios', {
      element,
      title: 'Scenarios',
      kind: 'scenario',
      items: partItems(rulePath, 'scenario', rule.scenarios),
    }),
  ];
};
