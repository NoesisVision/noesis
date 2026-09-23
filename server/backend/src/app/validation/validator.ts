import { err, ok, type Result } from 'neverthrow';
import type { ZodType, z } from 'zod';

/** What a rejected write answers with, in-band. */
interface ValidationIssue {
  /** JSONPath (`$.useCases[0].name`). */
  path: string;
  message: string;
}

/** The first `ISSUE_CAP` issues, and how many more were left out. */
export interface ValidationFailure {
  issues: ValidationIssue[];
  suppressed: number;
}

/** One structural mistake must not bury the first real cause. */
export const ISSUE_CAP = 20;

export function validate<T>(
  schema: ZodType<T>,
  raw: unknown,
): Result<T, ValidationFailure> {
  const parsed = schema.safeParse(raw);
  return parsed.success
    ? ok(parsed.data)
    : err(capped(parsed.error.issues.map(fromZodIssue)));
}

/** A failure of the file as a whole, before its shape is known. */
export function wholeFileIssue(message: string): ValidationFailure {
  return { issues: [{ path: '$', message }], suppressed: 0 };
}

export function formatReport(
  contractName: string,
  failure: ValidationFailure,
): string {
  const count = failure.issues.length + failure.suppressed;
  const head = `Invalid ${contractName}: ${count} issue${count === 1 ? '' : 's'}${
    failure.suppressed > 0
      ? ` (showing the first ${failure.issues.length}, ${failure.suppressed} suppressed)`
      : ''
  }.`;
  const body = failure.issues.map(
    (issue, i) => `${i + 1}. ${issue.path}: ${issue.message}`,
  );
  return [head, ...body].join('\n');
}

function capped(issues: ValidationIssue[]): ValidationFailure {
  return {
    issues: issues.slice(0, ISSUE_CAP),
    suppressed: Math.max(0, issues.length - ISSUE_CAP),
  };
}

function fromZodIssue(issue: z.core.$ZodIssue): ValidationIssue {
  return { path: jsonPath(issue.path), message: issue.message };
}

function jsonPath(segments: readonly PropertyKey[]): string {
  return segments.reduce<string>(
    (acc, segment) =>
      typeof segment === 'number'
        ? `${acc}[${segment}]`
        : `${acc}.${String(segment)}`,
    '$',
  );
}
