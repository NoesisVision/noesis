import type { DesignedRuleInput } from '#backend/app/design-docs/design-doc.ts';
import { Description } from './description.tsx';

export function RuleBody({ rule }: { rule: DesignedRuleInput }) {
  return <Description field={rule.description} />;
}
