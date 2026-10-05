import { clsx } from 'clsx';
import type { ComponentProps } from 'react';
import classes from './field-list.module.css';

/**
 * What is said about one thing, field by field: a `dl` whose names stand in a
 * column of their own beside their values. Its children are the `dt`s and
 * `dd`s.
 */
export function FieldList({ className, ...props }: ComponentProps<'dl'>) {
  return <dl className={clsx(classes.list, className)} {...props} />;
}
