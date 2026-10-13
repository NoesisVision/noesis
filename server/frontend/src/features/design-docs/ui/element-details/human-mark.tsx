import type { ReactNode } from 'react';
import {
  type DesignDocFieldInput,
  isHumanAuthored,
  valueOf,
} from '../../design-doc-field.ts';
import { HoverMarks } from '../unit-editor/hover-marks.tsx';
import classes from './human-mark.module.css';

type Fields = readonly (DesignDocFieldInput<unknown> | undefined)[];

/** Whether a human wrote any of the fields — and wrote something, not a blank. */
export function writtenByHuman(fields: Fields): boolean {
  return fields.some(
    (field) =>
      field !== undefined && isHumanAuthored(field) && !blank(valueOf(field)),
  );
}

/** Nothing written: no value, an empty text, an empty list. */
function blank(value: unknown): boolean {
  if (value === null || value === undefined) return true;
  if (typeof value === 'string') return value.trim() === '';
  if (Array.isArray(value)) return value.length === 0;
  return false;
}

/**
 * The dotted line under text a human wrote: the class for the element that
 * holds the text, or none.
 */
export function humanText(fields: Fields): string | undefined {
  return writtenByHuman(fields) ? classes.text : undefined;
}

/**
 * Text that is only read, marked when a human wrote it: the dotted line
 * under it, and pointed at, the figure that says so. What the agent wrote is
 * left as it is, with no tooltip. One wrapper for every such text in the
 * view, so it reads the same wherever it is.
 */
export function WrittenBy({
  fields,
  children,
}: {
  /** The fields the text is made of; one written by a human is enough. */
  fields: Fields;
  children: ReactNode;
}) {
  if (!writtenByHuman(fields)) return children;
  return (
    <span className={classes.written} data-written-by="human">
      {children}
      <HoverMarks human />
    </span>
  );
}

/**
 * The fields that mark a name, which has no writer of its own — a part is
 * known by it, and a renamed one looks no different. A human made the name
 * only where a human made the whole of it: every field it writes is a
 * human's, as a part a person added is. One field edited is not the name.
 */
export function nameFieldsOf(unit: object | null | undefined): Fields {
  const written = fieldsOf(unit).filter(
    (field) => field !== undefined && 'value' in field,
  );
  const madeByHuman =
    written.length > 0 &&
    written.every((field) => field !== undefined && isHumanAuthored(field));
  return madeByHuman ? written : [];
}

/** Every field a unit writes, whoever wrote it. */
function fieldsOf(unit: object | null | undefined): Fields {
  if (unit === null || unit === undefined) return [];
  return Object.values(unit).filter(
    (value): value is DesignDocFieldInput<unknown> =>
      typeof value === 'object' && value !== null && 'changed' in value,
  );
}
