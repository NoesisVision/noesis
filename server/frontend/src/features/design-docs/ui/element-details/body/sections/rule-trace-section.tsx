import { Text } from '#/shared/design-system/text.tsx';
import type { DesignDocFieldInput } from '../../../../design-doc-field.ts';
import type { ElementRef } from '../../element-ref.ts';
import { Field } from '../../field.tsx';
import { DetailSection } from './detail-section.tsx';
import classes from './rule-trace-section.module.css';

interface RuleTraceSectionProps {
  element: ElementRef;
  category: DesignDocFieldInput<string>;
  ruleType: DesignDocFieldInput<string>;
  /** The needs the rule answers, by name; `null` when the design leaves them as they are. */
  needs: string[] | null;
}

/**
 * What kind of rule it is, and why it is there: the needs it answers, or
 * none, which makes it a decision of the design's own.
 */
export function RuleTraceSection({
  category,
  ruleType,
  needs,
}: RuleTraceSectionProps) {
  return (
    <DetailSection>
      <dl className={classes.list}>
        <dt>Category</dt>
        <dd>
          <Field field={category} />
        </dd>
        <dt>Type</dt>
        <dd>
          <Field field={ruleType} />
        </dd>
        <dt>Needs</dt>
        <dd>
          {needs === null ? (
            'unchanged'
          ) : needs.length === 0 ? (
            <>
              Design decision
              <Text component="span" c="dimmed" size="sm">
                {' '}
                — no need asks for it
              </Text>
            </>
          ) : (
            <ul className={classes.needs}>
              {needs.map((need) => (
                <li key={need}>{need}</li>
              ))}
            </ul>
          )}
        </dd>
      </dl>
    </DetailSection>
  );
}
