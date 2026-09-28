import { Badge } from '#/shared/design-system/badge.tsx';
import {
  type DesignDocFieldInput,
  isHumanAuthored,
  isUnchanged,
  valueOf,
} from '../../design-doc-field.ts';

export function Field<T = string>({
  field,
  format = String,
  fallback = 'unchanged',
}: {
  field: DesignDocFieldInput<T>;
  format?: (value: T) => string;
  /** What stands in for a field the design leaves as it is. */
  fallback?: string;
}) {
  const value = valueOf(field);
  return (
    <>
      {isUnchanged(field) || value === null ? fallback : format(value)}
      {isHumanAuthored(field) && (
        <Badge size="xs" variant="light" ml="xs">
          by a human
        </Badge>
      )}
    </>
  );
}
