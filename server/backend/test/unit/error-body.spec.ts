import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { decodeError, ErrorBody } from '#backend/adapters/in/ui/error-body';
import { createUiApp } from '#backend/adapters/in/ui/ui.routes';
import { ChangeId } from '#backend/app/changes/model/change-id';
import { InvalidDesignDocError } from '#backend/app/changes/model/invalid-design-doc-error';
import { NotFoundError } from '#backend/app/changes/model/not-found-error';
import { ConcurrentModificationError } from '#backend/app/concurrent-modification-error';
import { type TestNoesis, testNoesis } from './test-noesis';

let t: TestNoesis;

beforeEach(async () => {
  t = await testNoesis();
});

afterEach(() => t.cleanup());

const CHANGE = ChangeId.parse('2026-09-24-payment-retry');

/** The answer of a route whose handler throws `error`, decoded again. */
async function roundTrip(
  error: Error,
): Promise<{ status: number; decoded: Error }> {
  const app = createUiApp({
    ...t,
    listChanges: { handle: () => Promise.reject(error) },
  });
  const response = await app.request('/changes');
  const json: unknown = await response.json();
  expect(ErrorBody.safeParse(json).success).toBe(true);
  return {
    status: response.status,
    decoded: decodeError(response.status, json),
  };
}

/** Field by field, message included, as `toEqual` does not compare errors so. */
function expectSameError(decoded: Error, thrown: Error): void {
  expect(decoded.constructor).toBe(thrown.constructor);
  expect(decoded.message).toBe(thrown.message);
  expect(Object.entries(decoded)).toEqual(Object.entries(thrown));
}

describe('ErrorBody', () => {
  it('rebuilds a missing change', async () => {
    const thrown = new NotFoundError('change', CHANGE);
    const { status, decoded } = await roundTrip(thrown);
    expect(status).toBe(404);
    expectSameError(decoded, thrown);
  });

  it('rebuilds a missing entry of a change, with the change it was looked for in', async () => {
    const thrown = new NotFoundError('design document', 'doc-1', CHANGE);
    const { status, decoded } = await roundTrip(thrown);
    expect(status).toBe(404);
    expectSameError(decoded, thrown);
    expect((decoded as NotFoundError).change).toBe(CHANGE);
  });

  it('rebuilds a write that lost a race', async () => {
    const thrown = new ConcurrentModificationError('change', CHANGE);
    const { status, decoded } = await roundTrip(thrown);
    expect(status).toBe(409);
    expectSameError(decoded, thrown);
  });

  it('rebuilds a design document that breaks its rules, every violation included', async () => {
    const thrown = new InvalidDesignDocError([
      { path: 'modules.removed[a]', reason: 'changedInGreenField' },
      { path: 'modules.added[b].name', reason: 'humanAuthor' },
    ]);
    const { status, decoded } = await roundTrip(thrown);
    expect(status).toBe(422);
    expectSameError(decoded, thrown);
  });

  it('answers anything unforeseen with 500, decoded as a plain error', async () => {
    const { status, decoded } = await roundTrip(new Error('disk on fire'));
    expect(status).toBe(500);
    expect(decoded.constructor).toBe(Error);
    expect(decoded.message).not.toContain('disk on fire');
  });

  it('decodes the codes no domain error stands behind as plain errors', () => {
    const answers: [number, ErrorBody][] = [
      [400, { error: 'invalid_body', issues: [{ path: 'name' }] }],
      [413, { error: 'payload_too_large', limit: 10 }],
      [503, { error: 'shutting_down' }],
    ];
    for (const [status, body] of answers) {
      const decoded = decodeError(status, body);
      expect(decoded.constructor).toBe(Error);
    }
    expect(decodeError(413, answers[1]?.[1]).message).toContain('10 bytes');
  });

  it('quotes the status of a body that is no error answer', () => {
    const decoded = decodeError(502, { message: 'bad gateway' });
    expect(decoded.message).toContain('502');
  });
});
