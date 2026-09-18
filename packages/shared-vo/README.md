# @repo/shared-vo

Value objects shared across the workspace. Runtime code — unlike
`@repo/shared-contracts`, which is declarative zod only and is copied into
the plugin for the agent to read (decision D4), nothing here is shipped as
reference material.

- `uuid.ts` — the ids the service mints (decision D2): `newUuid()` is
  time-ordered (UUIDv7) for what the graph authors itself; `contentHashAsUuid()`
  is a SHA-256 of imported content shaped as a UUID, so a re-import of the same
  source yields the same id; `sha256()` is the raw hash.

Runs on bun (`Bun.randomUUIDv7`); not for the browser.
