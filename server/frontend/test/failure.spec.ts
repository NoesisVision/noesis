import { expect, it } from 'bun:test';
import { ApiError } from '../src/shared/api/client';
import { describeFailure } from '../src/shared/api/failure';

it('says what the surface said, under the status it said it with', () => {
  expect(describeFailure(new ApiError(404, { error: 'not_found' }))).toEqual({
    code: '404',
    title: 'Not found',
    description: 'This item is no longer part of this change.',
  });
  expect(
    describeFailure(new ApiError(404, { error: 'change_not_found' }))
      .description,
  ).toBe('There is no such change in this repository.');
});

it('falls back to the status when the body carries no code it knows', () => {
  const unknownCode = describeFailure(new ApiError(404, { error: 'whatever' }));
  expect(unknownCode.code).toBe('404');
  expect(unknownCode.description).not.toContain('whatever');

  // Hono's own 500 is plain text, so the client parses no body at all.
  const failed = describeFailure(new ApiError(500, null));
  expect(failed.code).toBe('500');
  expect(failed.title).toBe('The service failed');
});

it('names the unreachable service rather than a status it never got', () => {
  const offline = describeFailure(new TypeError('Failed to fetch'));
  expect(offline.code).toBe('Offline');
  expect(offline.title).toBe('Cannot reach Noesis');
});

it('keeps the message of a crash, which is the only clue it has', () => {
  expect(describeFailure(new Error('x is not a function'))).toEqual({
    code: 'Error',
    title: 'Something went wrong',
    description: 'x is not a function',
  });
  expect(describeFailure('nothing thrown as an error').description).toBe(
    'This page could not be drawn.',
  );
});
