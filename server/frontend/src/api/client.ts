/**
 * The `/ui` surface, called as plain JSON over `fetch` and typed by the
 * contracts both sides share (`@repo/shared-contracts`). Hono's `hc<AppType>`
 * was the plan, but importing the service's route type pulls its whole
 * module graph — `node:fs`, `Bun` — into this package's type program, which
 * has no server types by design (a client-only SPA, decision 67). A typed RPC
 * client returns when the service emits declarations for it.
 */
export class ApiError extends Error {
  readonly status: number;
  readonly body: unknown;

  constructor(status: number, body: unknown) {
    super(`Request failed with status ${status}`);
    this.name = 'ApiError';
    this.status = status;
    this.body = body;
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    ...init,
    headers: { accept: 'application/json', ...init?.headers },
  });
  const body: unknown = res.headers
    .get('content-type')
    ?.includes('application/json')
    ? await res.json()
    : null;
  if (!res.ok) throw new ApiError(res.status, body);
  return body as T;
}

export const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, json: unknown) =>
    request<T>(path, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(json),
    }),
};
