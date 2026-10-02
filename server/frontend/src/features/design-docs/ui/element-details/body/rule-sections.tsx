import type { ReactElement } from 'react';
import type { DesignedRuleInput } from '#backend/app/design-docs/design-doc.ts';
import { isUnchanged, valueOf } from '../../../design-doc-field.ts';
import { type NeedsInput, needNamesOf } from '../change-list-items.ts';
import type { ElementRef, OwnerRef } from '../element-ref.ts';
import { section } from './section.ts';
import { DescriptionSection } from './sections/description-section.tsx';
import { RuleTraceSection } from './sections/rule-trace-section.tsx';

/** A rule's own scenarios read in the column beside these sections. */
export const ruleSections = (
  owner: OwnerRef,
  rule: DesignedRuleInput,
  needs: NeedsInput,
): ReactElement[] => {
  const element: ElementRef = { owner, part: 'rules', name: rule.name };
  const traced = valueOf(rule.needs);
  return [
    ...section(RuleTraceSection, 'trace', {
      element,
      category: rule.category,
      ruleType: rule.ruleType,
      needs: traced === null ? null : needNamesOf(traced, needs),
    }),
    ...section(DescriptionSection, 'description', {
      element,
      field: rule.description,
    }),
    // Optional: a rule its source gives no reason for has none to show.
    ...(isUnchanged(rule.rationale)
      ? []
      : section(DescriptionSection, 'rationale', {
          element,
          title: 'Rationale',
          field: rule.rationale,
        })),
  ];
};
