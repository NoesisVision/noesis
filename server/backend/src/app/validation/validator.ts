import type { ZodType, z } from 'zod';

/**
 * One problem in a document, written to be acted on rather than read
 * (decision D3): where, what was expected against what is there, and the one
 * line that fixes it. The agent edits the working file in place from this
 * instead of regenerating it.
 */
export interface ValidationIssue {
  /** JSONPath-style location: `$.useCases[0].name`. Integrity issues address elements by id: `#svc-booking`. */
  path: string;
  expected: string;
  found: string;
  fix: string;
}

export type ValidationReport<T = unknown> =
  | { ok: true; value: T; issues: []; suppressed: 0 }
  | { ok: false; issues: ValidationIssue[]; suppressed: number };

/**
 * A contract for a whole file: the shape as a zod schema, plus the integrity
 * rules the schema cannot express, which run only once the shape parses.
 */
export interface FileContract<T = unknown> {
  description: string;
  schema: ZodType<T>;
  // Method syntax on purpose: it is bivariant, so a `FileContract<Doc>` fits a
  // `Record<string, FileContract>` registry (a property would not).
  check?(value: T): ValidationIssue[];
}

/** One structural mistake must not bury the first real cause. */
export const ISSUE_CAP = 20;

/**
 * The one validator: the `validate` MCP tool runs it against a working file,
 * and every service write runs it again — a failed save is never how the
 * agent discovers a shape error, but it is the guarantee.
 */
export function validate<T>(
  contract: FileContract<T>,
  raw: unknown,
): ValidationReport<T> {
  const parsed = contract.schema.safeParse(raw);
  if (!parsed.success) {
    return capped(parsed.error.issues.flatMap((i) => fromZodIssue(i, raw)));
  }
  const issues = contract.check?.(parsed.data) ?? [];
  if (issues.length > 0) return capped(issues);
  return { ok: true, value: parsed.data, issues: [], suppressed: 0 };
}

/** A report with a single issue, for problems found before the schema runs (unreadable JSON). */
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
    (issue, i) =>
      `${i + 1}. ${issue.path}\n   expected: ${issue.expected}\n   found:    ${issue.found}\n   fix:      ${issue.fix}`,
  );
  return [head, ...body].join('\n\n');
}

function capped(issues: ValidationIssue[]): ValidationReport<never> {
  return {
    ok: false,
    issues: issues.slice(0, ISSUE_CAP),
    suppressed: Math.max(0, issues.length - ISSUE_CAP),
  };
}

function fromZodIssue(
  issue: z.core.$ZodIssue,
  raw: unknown,
): ValidationIssue[] {
  const path = jsonPath(issue.path);
  const value = valueAt(raw, issue.path);
  const found = describe(value);

  switch (issue.code) {
    case 'invalid_type':
      return [
        {
          path,
          expected: issue.expected,
          found,
          fix:
            value === undefined
              ? `Add "${path}" as ${anOf(issue.expected)}`
              : `Replace "${path}" with ${anOf(issue.expected)}`,
        },
      ];
    case 'invalid_value':
      return [
        {
          path,
          expected: `one of ${issue.values.map((v) => JSON.stringify(v)).join(', ')}`,
          found,
          fix: `Set "${path}" to one of the listed values`,
        },
      ];
    case 'unrecognized_keys':
      return issue.keys.map((key) => ({
        path: jsonPath([...issue.path, key]),
        expected: 'no such field',
        found: 'a field the contract does not declare',
        fix: `Remove "${jsonPath([...issue.path, key])}"`,
      }));
    case 'too_small':
      return [
        {
          path,
          expected: `${issue.origin} of at least ${issue.minimum}`,
          found,
          fix: `Extend "${path}" to at least ${issue.minimum}`,
        },
      ];
    case 'too_big':
      return [
        {
          path,
          expected: `${issue.origin} of at most ${issue.maximum}`,
          found,
          fix: `Shorten "${path}" to at most ${issue.maximum}`,
        },
      ];
    case 'invalid_union':
      return [
        {
          path,
          expected: 'a value matching one of the alternatives at this position',
          found,
          fix: `Rewrite "${path}" to match exactly one alternative in the contract`,
        },
      ];
    default:
      return [
        {
          path,
          expected: issue.message,
          found,
          fix: `Correct "${path}": ${issue.message}`,
        },
      ];
  }
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

function valueAt(raw: unknown, segments: readonly PropertyKey[]): unknown {
  let current = raw;
  for (const segment of segments) {
    if (current === null || typeof current !== 'object') return undefined;
    current = (current as Record<PropertyKey, unknown>)[segment];
  }
  return current;
}

const PREVIEW_LENGTH = 60;

function describe(value: unknown): string {
  if (value === undefined) return 'nothing (the field is missing)';
  if (value === null) return 'null';
  if (Array.isArray(value)) return `an array of ${value.length}`;
  if (typeof value === 'object') {
    const keys = Object.keys(value);
    const shown = keys.slice(0, 5).join(', ');
    return `an object with keys ${shown}${keys.length > 5 ? ', …' : ''}`;
  }
  if (typeof value === 'string') {
    const quoted = JSON.stringify(value);
    return quoted.length > PREVIEW_LENGTH
      ? `${quoted.slice(0, PREVIEW_LENGTH)}…" (${value.length} chars)`
      : quoted;
  }
  if (typeof value === 'number' || typeof value === 'boolean') {
    return `${value} (${typeof value})`;
  }
  return typeof value;
}

function anOf(noun: string): string {
  return /^[aeiou]/i.test(noun) ? `an ${noun}` : `a ${noun}`;
}
