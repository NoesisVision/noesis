import { Badge } from '#/shared/design-system/badge.tsx';
import {
  type DesignDocFieldInput,
  isHumanAuthored,
  valueOf,
} from '../../design-doc-field.ts';

export function Field<T = string>({
  field,
  format = String,
  fallback = 'Not specified.',
}: {
  field: DesignDocFieldInput<T>;
  format?: (value: T) => string;
  fallback?: string;
}) {
  const value = valueOf(field);
  return (
    <>
      {value === null ? fallback : format(value)}
      {isHumanAuthored(field) && (
        <Badge size="xs" variant="light" ml="xs">
          by a human
        </Badge>
      )}
    </>
  );
}
