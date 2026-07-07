import type { createApp } from './app.js';

// The ui app's ONLY import surface from this package (via the `./client`
// exports entry): the inferred route tree for `hc<AppType>`. Type-only by
// design — a value export here could be imported into the browser bundle and
// drag server code (and its native deps) along with it.
export type AppType = ReturnType<typeof createApp>;
