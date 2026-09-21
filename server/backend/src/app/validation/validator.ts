import type { ZodType, z } from 'zod';

/** What a rejected write answers with, in-band. */
export interface ValidationIssue {
  /** JSONPath (`$.useCases[0].name`), or an element id (`#svc-booking`) for integrity issues. */
  path: string;
  message: string;
}

export type ValidationReport<T = unknown> =
  | { ok: true; value: T; issues: []; suppressed: 0 }
  | { ok: false; issues: ValidationIssue[]; suppressed: number };

export interface FileContract<T = unknown> {
  schema: ZodType<T>;
  // Method syntax on purpose: it is bivariant, so a `FileContract<Doc>` is
  // assignable to `FileContract` (a property declaration would not be).
  check?(value: T): ValidationIssue[];
}

/** One structural mistake must not bury the first real cause. */
export const ISSUE_CAP = 20;

export function validate<T>(
  contract: FileContract<T>,
  raw: unknown,
): ValidationReport<T> {
  const parsed = contract.schema.safeParse(raw);
  if (!parsed.success) {
    return capped(parsed.error.issues.map(fromZodIssue));
  }
  const issues = contract.check?.(parsed.data) ?? [];
  if (issues.length > 0) return capped(issues);
  return { ok: true, value: parsed.data, issues: [], suppressed: 0 };
}

export function singleIssue(issue: ValidationIssue): ValidationReport<never> {
  return { ok: false, issues: [issue], suppressed: 0 };
}

export function formatReport(
  contractName: string,
  report: ValidationReport,
): string {
  if (report.ok) return `Valid ${contractName}: no issues.`;
  const count = report.issues.length + report.suppressed;
  const head = `Invalid ${contractName}: ${count} issue${count === 1 ? '' : 's'}${
    report.suppressed > 0
      ? ` (showing the first ${report.issues.length}, ${report.suppressed} suppressed)`
      : ''
  }.`;
  const body = report.issues.map(
    (issue, i) => `${i + 1}. ${issue.path}: ${issue.message}`,
  );
  return [head, ...body].join('\n');
}

function capped(issues: ValidationIssue[]): ValidationReport<never> {
  return {
    ok: false,
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
