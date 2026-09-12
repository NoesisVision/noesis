<!-- Copied from packages/shared-contracts/src/change.md by @noesis-vision/noesis 0.1.0-beta.4. Do not edit: run `bun run generate`. -->

# Changes

Companion to `change.ts`.

A change is the unit of work the graph tracks, and the unit of review: every
import made while working on it and every design document describing it lands
in `changes/<slug>/`, so a pull request carries the whole record of the change
in one directory.

- The directory name is the slug: lower-case kebab-case, at most 64
  characters, derived from `name` when the change is created and never changed
  after, so paths and references stay valid. A rename changes `name`, not the
  slug.
- `change.json` in the directory is the metadata this contract describes.
  Everything else in the directory is under `conversations/`, `documents/` or
  `design-docs/`.
- `type` uses the commit-type vocabulary (`feature`, `fix`, `improvement`,
  `chore`) so the change list and the commits that implement it speak the same
  language.
- `status` moves forward through `discovery`, `design`, `implementation`,
  `done`. The order in the contract is the lifecycle order; sort by it.
- `key` is the team's tracker key when there is one; leave it empty rather
  than inventing one.

Skills do not create change directories. The service does, through its
create endpoint or tool; the agent names the change by slug when it imports or
designs.
