import { List } from '#/shared/design-system/list.tsx';
import { Text } from '#/shared/design-system/text.tsx';
import {
  DESIGN_DECISION,
  DESIGN_DECISION_REASON,
} from '../design-doc-requirements.ts';

/**
 * The needs a rule answers, as the value of a field: each by its name; or
 * none, which makes the rule a decision of the design's own; or `unchanged`
 * when the design leaves them as they are.
 */
export function TracedNeeds({ needs }: { needs: string[] | null }) {
  if (needs === null) return 'unchanged';
  if (needs.length === 0)
    return (
      <>
        {DESIGN_DECISION}
        <Text component="span" c="dimmed" size="sm">
          {' '}
          — {DESIGN_DECISION_REASON}
        </Text>
      </>
    );
  return (
    <List fz="inherit" ps="md">
      {needs.map((need) => (
        <List.Item key={need}>{need}</List.Item>
      ))}
    </List>
  );
}
