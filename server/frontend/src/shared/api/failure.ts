import { ApiError } from './client.ts';

/** A failure in the words the page shows it in. */
export interface Failure {
  code: string;
  title: string;
  description: string;
}

// The `/ui` surface answers a failure with `{ error: '<code>' }`. The code is
// for the caller, so the page needs a sentence for each one it can meet.
const API_MESSAGES: Record<string, string> = {
  change_not_found: 'There is no such change in this repository.',
  not_found: 'This item is no longer part of this change.',
};

export function describeFailure(error: unknown): Failure {
  if (error instanceof ApiError) return apiFailure(error);
  // `fetch` rejects with a TypeError when it never reached the service.
  if (error instanceof TypeError) {
    return {
      code: 'Offline',
      title: 'Cannot reach Noesis',
      description:
        'The service answers beside your agent session, and stops when that session closes.',
    };
  }
  return {
    code: 'Error',
    title: 'Something went wrong',
    description: messageOf(error) ?? 'This page could not be drawn.',
  };
}

function apiFailure(error: ApiError): Failure {
  // `error.message` is the wire code itself, which is not a sentence.
  const said = API_MESSAGES[codeOf(error.body) ?? ''];
  if (error.status === 404) {
    return {
      code: '404',
      title: 'Not found',
      description: said ?? 'This page points at something that is not there.',
    };
  }
  if (error.status >= 500) {
    return {
      code: String(error.status),
      title: 'The service failed',
      description:
        said ?? 'Noesis could not answer this request. Its log has the reason.',
    };
  }
  return {
    code: String(error.status),
    title: 'Request failed',
    description: said ?? 'The service refused this request.',
  };
}

function codeOf(body: unknown): string | null {
  if (typeof body !== 'object' || body === null) return null;
  const { error } = body as { error?: unknown };
  return typeof error === 'string' ? error : null;
}

function messageOf(error: unknown): string | null {
  if (!(error instanceof Error) || error.message.trim() === '') return null;
  return error.message;
}
