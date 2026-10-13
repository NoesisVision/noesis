import type { ReactNode } from 'react';
import {
  type DesignDocFieldInput,
  isUnchanged,
  valueOf,
} from '../../design-doc-field.ts';
import { WrittenBy } from './human-mark.tsx';

export function Field<T = string>({
  field,
  format = String,
  fallback = 'unchanged',
  render = (text) => text,
}: {
  field: DesignDocFieldInput<T>;
  format?: (value: T) => string;
  /** What stands in for a field the design leaves as it is. */
  fallback?: string;
  /** Draws the value once formatted; the fallback is drawn as it is. */
  render?: (text: string) => ReactNode;
}) {
  const value = valueOf(field);
  return isUnchanged(field) || value === null ? (
    fallback
  ) : (
    // Who wrote it, as everywhere in the view: a human's is marked.
    <WrittenBy fields={[field]}>{render(format(value))}</WrittenBy>
  );
}
