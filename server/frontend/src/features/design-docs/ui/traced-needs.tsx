import { Text } from '#/shared/design-system/text.tsx';
import classes from './traced-needs.module.css';

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
        Design decision
        <Text component="span" c="dimmed" size="sm">
          {' '}
          — no need asks for it
        </Text>
      </>
    );
  return (
    <ul className={classes.needs}>
      {needs.map((need) => (
        <li key={need}>{need}</li>
      ))}
    </ul>
  );
}
