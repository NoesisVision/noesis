import { describe, expect, it } from 'bun:test';
import { z } from 'zod';
import { designDocumentContract } from '#backend/app/validation/contracts/design-document';
import {
  type FileContract,
  formatReport,
  ISSUE_CAP,
  validate,
} from '#backend/app/validation/validator';
import { designDocFixture } from '#backend/shared/contracts/design-doc.fixture';

const schema = z.strictObject({
  name: z.string(),
  kind: z.enum(['note', 'task']),
  tags: z.array(z.string()).min(1),
  nested: z.object({ count: z.number() }).optional(),
});

const contract: FileContract<z.infer<typeof schema>> = {
  description: 'a test contract',
  schema,
};

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

  it('names a missing field with an "add" fix', () => {
    const report = validate(contract, { kind: 'note', tags: ['a'] });
    expect(report.ok).toBe(false);
    expect(report.issues).toEqual([
      {
        path: '$.name',
        expected: 'string',
        found: 'nothing (the field is missing)',
        fix: 'Add "$.name" as a string',
      },
    ]);
  });

  it('names a wrong type with what it found and a "replace" fix', () => {
    const report = validate(contract, { ...valid, name: 42 });
    expect(report.issues).toEqual([
      {
        path: '$.name',
        expected: 'string',
        found: '42 (number)',
        fix: 'Replace "$.name" with a string',
      },
    ]);
  });

  it('lists the allowed values for an enum', () => {
    const [issue] = validate(contract, { ...valid, kind: 'memo' }).issues;
    expect(issue?.path).toBe('$.kind');
    expect(issue?.expected).toBe('one of "note", "task"');
    expect(issue?.found).toBe('"memo"');
  });

  it('turns each unrecognised key into its own "remove" issue', () => {
    const report = validate(contract, { ...valid, extra: 1, more: 2 });
    expect(report.issues.map((i) => i.fix)).toEqual([
      'Remove "$.extra"',
      'Remove "$.more"',
    ]);
  });

  it('addresses array elements by index', () => {
    const [issue] = validate(contract, { ...valid, tags: ['a', 7] }).issues;
    expect(issue?.path).toBe('$.tags[1]');
  });

  it('describes a too-small array', () => {
    const [issue] = validate(contract, { ...valid, tags: [] }).issues;
    expect(issue?.expected).toBe('array of at least 1');
    expect(issue?.found).toBe('an array of 0');
  });

  it('caps the list and counts the rest', () => {
    const tags = Array.from({ length: ISSUE_CAP + 5 }, () => 1);
    const report = validate(contract, { ...valid, tags });
    expect(report.issues).toHaveLength(ISSUE_CAP);
    expect(report.suppressed).toBe(5);
  });

  it('runs the integrity check only when the shape parses', () => {
    const report = validate(designDocumentContract, designDocFixture);
    expect(report.ok).toBe(true);

    const broken = {
      ...designDocFixture,
      buildingBlocks: designDocFixture.buildingBlocks.filter(
        (b) => b.id !== 'svc-booking',
      ),
    };
    const rejected = validate(designDocumentContract, broken);
    expect(rejected.ok).toBe(false);
    const [issue] = rejected.issues;
    expect(issue?.path.startsWith('#')).toBe(true);
    expect(issue?.expected).toBe('no unresolved reference');
    expect(issue?.found).toContain('svc-booking');
    expect(issue?.fix).toContain('add the missing element');
  });
});

describe('formatReport', () => {
  it('says so when there is nothing to fix', () => {
    expect(formatReport('design-document', validate(contract, valid))).toBe(
      'Valid design-document: no issues.',
    );
  });

  it('numbers the issues with path, expected, found and fix', () => {
    const text = formatReport(
      'test',
      validate(contract, { kind: 'note', tags: ['a'] }),
    );
    expect(text).toBe(
      [
        'Invalid test: 1 issue.',
        '1. $.name\n   expected: string\n   found:    nothing (the field is missing)\n   fix:      Add "$.name" as a string',
      ].join('\n\n'),
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
