import { describe, expect, it } from 'bun:test';
import { z } from 'zod';
import {
  type FileContract,
  formatReport,
  ISSUE_CAP,
  validate,
} from '#backend/app/validation/validator';

const schema = z.strictObject({
  name: z.string(),
  kind: z.enum(['note', 'task']),
  tags: z.array(z.string()).min(1),
  nested: z.object({ count: z.number() }).optional(),
});

const contract: FileContract<z.infer<typeof schema>> = { schema };

const valid = { name: 'x', kind: 'note' as const, tags: ['a'] };

describe('validate', () => {
  it('returns the parsed value when the document is clean', () => {
    const report = validate(contract, valid);
    expect(report).toEqual({
      ok: true,
      value: valid,
      issues: [],
      suppressed: 0,
    });
  });

  it("names a missing field by its JSON path, with zod's message", () => {
    const report = validate(contract, { kind: 'note', tags: ['a'] });
    expect(report.ok).toBe(false);
    expect(report.issues).toEqual([
      {
        path: '$.name',
        message: 'Invalid input: expected string, received undefined',
      },
    ]);
  });

  it('reports unrecognised keys at the object that holds them', () => {
    const report = validate(contract, { ...valid, extra: 1, more: 2 });
    expect(report.issues).toEqual([
      { path: '$', message: 'Unrecognized keys: "extra", "more"' },
    ]);
  });

  it('addresses array elements by index', () => {
    const [issue] = validate(contract, { ...valid, tags: ['a', 7] }).issues;
    expect(issue?.path).toBe('$.tags[1]');
  });

  it('caps the list and counts the rest', () => {
    const tags = Array.from({ length: ISSUE_CAP + 5 }, () => 1);
    const report = validate(contract, { ...valid, tags });
    expect(report.issues).toHaveLength(ISSUE_CAP);
    expect(report.suppressed).toBe(5);
  });

  it('runs the integrity check only when the shape parses', () => {
    let checked = 0;
    const checking: FileContract<z.infer<typeof schema>> = {
      schema,
      check: (value) => {
        checked += 1;
        return value.tags.includes('b')
          ? []
          : [{ path: '#b', message: 'tag b is missing' }];
      },
    };

    expect(validate(checking, { ...valid, tags: ['a', 'b'] }).ok).toBe(true);

    const rejected = validate(checking, valid);
    expect(rejected.ok).toBe(false);
    expect(rejected.issues).toEqual([
      { path: '#b', message: 'tag b is missing' },
    ]);

    expect(validate(checking, { kind: 'note', tags: ['a'] }).ok).toBe(false);
    expect(checked).toBe(2);
  });
});

describe('formatReport', () => {
  it('says so when there is nothing to fix', () => {
    expect(formatReport('design-document', validate(contract, valid))).toBe(
      'Valid design-document: no issues.',
    );
  });

  it('numbers the issues with path and message', () => {
    const text = formatReport(
      'test',
      validate(contract, { kind: 'note', tags: ['a'] }),
    );
    expect(text).toBe(
      [
        'Invalid test: 1 issue.',
        '1. $.name: Invalid input: expected string, received undefined',
      ].join('\n'),
    );
  });

  it('reports how many issues the cap hid', () => {
    const tags = Array.from({ length: ISSUE_CAP + 3 }, () => 1);
    const text = formatReport('test', validate(contract, { ...valid, tags }));
    expect(text.split('\n')[0]).toBe(
      `Invalid test: ${ISSUE_CAP + 3} issues (showing the first ${ISSUE_CAP}, 3 suppressed).`,
    );
  });
});
