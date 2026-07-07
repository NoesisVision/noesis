import type { AppType } from 'backend/client';
import { hc } from 'hono/client';

// Typed RPC client inferred from the server's route tree: path, method,
// params, and response types all come from `AppType`. Import ONLY types from
// the `server` package (decision 28) — a value import would pull server code
// into the browser bundle.
export const client = hc<AppType>(window.location.origin);
