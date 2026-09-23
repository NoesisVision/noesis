import { describe, expect, it } from 'bun:test';
import { z } from 'zod';
import {
  formatReport,
  ISSUE_CAP,
  type ValidationFailure,
  validate,
} from '#backend/app/validation/validator';

const schema = z.strictObject({
  name: z.string(),
  kind: z.enum(['note', 'task']),
  tags: z.array(z.string()).min(1),
  nested: z.object({ count: z.number() }).optional(),
});

const valid = { name: 'x', kind: 'note' as const, tags: ['a'] };

/** The failure of a document the spec knows is invalid. */
function failureOf(raw: unknown): ValidationFailure {
  return validate(schema, raw)._unsafeUnwrapErr();
}

describe('validate', () => {
  it('returns the parsed value when the document is clean', () => {
    expect(validate(schema, valid)._unsafeUnwrap()).toEqual(valid);
  });

  it("names a missing field by its JSON path, with zod's message", () => {
    expect(failureOf({ kind: 'note', tags: ['a'] }).issues).toEqual([
      {
        path: '$.name',
        message: 'Invalid input: expected string, received undefined',
      },
    ]);
  });

  it('reports unrecognised keys at the object that holds them', () => {
    expect(failureOf({ ...valid, extra: 1, more: 2 }).issues).toEqual([
      { path: '$', message: 'Unrecognized keys: "extra", "more"' },
    ]);
  });

  it('addresses array elements by index', () => {
    const [issue] = failureOf({ ...valid, tags: ['a', 7] }).issues;
    expect(issue?.path).toBe('$.tags[1]');
  });

  it('caps the list and counts the rest', () => {
    const tags = Array.from({ length: ISSUE_CAP + 5 }, () => 1);
    const failure = failureOf({ ...valid, tags });
    expect(failure.issues).toHaveLength(ISSUE_CAP);
    expect(failure.suppressed).toBe(5);
  });
});

describe('formatReport', () => {
  it('numbers the issues with path and message', () => {
    const text = formatReport('test', failureOf({ kind: 'note', tags: ['a'] }));
    expect(text).toBe(
      [
        'Invalid test: 1 issue.',
        '1. $.name: Invalid input: expected string, received undefined',
      ].join('\n'),
    );
  });

  it('reports how many issues the cap hid', () => {
    const tags = Array.from({ length: ISSUE_CAP + 3 }, () => 1);
    const text = formatReport('test', failureOf({ ...valid, tags }));
    expect(text.split('\n')[0]).toBe(
      `Invalid test: ${ISSUE_CAP + 3} issues (showing the first ${ISSUE_CAP}, 3 suppressed).`,
    );
  });
});
