---
type: feat
scope: server
status: planned
created: 2026-09-09
---

# Feature Plan: Change-scoped app shell (Mantine, option C sidebar)

**Prototype:** [`change-shell-prototype.html`](./change-shell-prototype.html) —
static mock of three sidebar structures; **option C ("Flat + pinned")** is the
one being built. Options A and B stay in the file for reference.
**Goal:** Give `server/frontend` (React + Vite SPA on TanStack Router —
decisions 63 and 67) a
real application shell: a left sidebar with a **change picker** on top, four
flat change-scoped entries below it, and a pinned bottom zone with the
change-independent **System model** and **Wiki** links. A small change backend
supplies the picker. Every content view renders only breadcrumbs and the
view name; real content is later work.

## Requirements (agreed 2026-09-09)

### Terminology

- **Change** — the unit of work the sidebar is scoped to (was "task" in the
  first mockup). Users see "Change", "Changes", "New change".
- **Documentation** — the change-independent area: System model and Wiki
  (was "Workspace"). Used as sidebar section label and breadcrumb root.

### Left sidebar (option C)

- **Change picker** at the very top: a Select-like button showing the current
  change's colour swatch, name, key and status badge. Clicking opens a menu
  listing all changes (current one marked) plus a **New change** entry that opens
  a create modal. Choosing a change navigates to that change's Overview.
- Below the picker, exactly four **change-scoped entries**, each with icon,
  label and a one-line description:
  **Overview**, **Documents**, **Conversations**, **Design docs**.
  No counts (nothing to count yet). Active entry follows the route.
- **Pinned bottom zone** (tinted background, top border, section label
  "Documentation"): **System model** and **Wiki**. Independent of the selected
  change; always visible without scrolling.
- Desktop sidebar is always open, fixed width 280 px. Below the `md`
  breakpoint it collapses into Mantine's AppShell drawer, toggled by a burger
  in the header. No desktop icon-collapse in this iteration.

### Header

- Burger (mobile only), product mark + "Noesis", a colour-scheme toggle
  (light/dark/auto via Mantine's `useMantineColorScheme`). No search, no
  notifications, no user menu.

### Content views

- Every view renders one shared `ViewHeader`: breadcrumbs then the view title.
  Nothing else. Breadcrumb roots: `Changes / <change name> / <view>` for change
  views, `Documentation / <view>` for System model and Wiki.

### Routes

Change id lives in the path; all three content kinds hang under the change:

| Path                               | View          |
| ---------------------------------- | ------------- |
| `/`                                | redirect      |
| `/changes/$changeId`               | Overview      |
| `/changes/$changeId/documents`     | Documents     |
| `/changes/$changeId/conversations` | Conversations |
| `/changes/$changeId/design-docs`   | Design docs   |
| `/system-model`                    | System model  |
| `/wiki`                            | Wiki          |

- `/` redirects to the **last-opened change** (`localStorage`
  `noesis.shell.lastChangeId`) when it still exists, else the first change in the
  list, else an empty state with a "Create your first change" button.
- On `/system-model` and `/wiki` the picker keeps showing the last-opened
  change, and the four change entries link into that change.
- Unknown `changeId` renders a not-found view inside the shell.

### Change backend

- New `Change` node in the LadybugDB graph, top-level and unscoped — there is
  no `Project` to hang it off any more (decision 65 removed the concept), and
  the server serves the one checkout it was started in.
- Fields: `id` (server-generated UUIDv7), `name`, `key` (e.g. `NOE-142`),
  `status` (`discovery | design | implementation | done` — a lifecycle in
  that order; the contract keeps the enum in lifecycle order so later
  sorting and "advance" actions need no second list), plus the
  system-managed `created_at`. No `version` column: decision 65 dropped
  optimistic concurrency, since a single local writer cannot race itself.
- Status badge colours (picker and future lists): `discovery` gray,
  `design` violet, `implementation` brand blue, `done` green. One
  `CHANGE_STATUS_META` map in the frontend owns label + colour per status.
- Endpoints on the `/ui` surface (unguarded, like every route since decision
  65): `GET /ui/changes` (list, newest first), `GET /ui/changes/:id`,
  `POST /ui/changes` (`{ name, key }`, status starts as `discovery`).
  Duplicate `key` → 409 `{ error: 'duplicate_key' }`; invalid body → 400.
- **Seed:** on boot, when the `Change` table is empty, insert three example
  changes. There is no deployment mode left to gate on — one local server per
  checkout (decision 65) — so the empty table is the whole condition.

| key     | name                       | status         |
| ------- | -------------------------- | -------------- |
| NOE-142 | Payment retry policy       | implementation |
| NOE-137 | Tenant onboarding redesign | design         |
| NOE-129 | Audit log export           | done           |

### Styling

- **Mantine** (`@mantine/core`, `@mantine/hooks`, `@tabler/icons-react`,
  `postcss-preset-mantine`). **Tailwind is removed** from `server/frontend`.
- Theme: `createTheme` with `primaryColor: 'brand'` — a 10-step ramp derived
  from the noesis.vision `blue-700` (decision 60's palette, kept as brand
  guidance by decision 66), `fontFamily`
  Raleway via `@fontsource-variable/raleway`, `defaultRadius: 'sm'`.
  Everything else Mantine default.
- Colour scheme `auto` by default, persisted by Mantine's
  `localStorageColorSchemeManager` under key `noesis.shell.colorScheme`.

### Auth

- There is none, anywhere: decision 65 removed authentication, sessions and
  the `/auth` surface. The frontend has no session guard and no login route,
  and nothing in this feature reintroduces a trust boundary.

## Guiding facts

- Frontend today: bare `create-tsrouter-app` scaffold (`__root.tsx`,
  `index.tsx`, `components/home.tsx`), Tailwind v4 via `@tailwindcss/vite`,
  TanStack Query wired in `integrations/tanstack-query/`, React Compiler on.
  Free to restructure.
- Nothing renders outside the browser (decision 67 dropped TanStack Start),
  so Mantine's `ColorSchemeScript` goes in `index.html` and `localStorage` may
  be read anywhere. `main.tsx` is the entry: providers wrap `RouterProvider`
  there, not in the root route.
- Backend: one Hono sub-app per surface (`app.ts`); `/ui` routes are typed
  through `hc<AppType>` from `backend/client`. The `.route()` chain must stay
  unbroken. Repositories run Cypher through `DatabaseService`; schema is the
  single `GRAPH_SCHEMA` list; ids come from `@repo/shared-contracts/uuid`.
- Existing entities (design docs and inbox, both top-level since decision 65)
  are untouched. Configuration is one variable, `NOESIS_DATA_DIR`.
- `docs/decisions.md` numbering ends at 66; decision 66 retired the old
  frontend stack, so `docs/stack.md` lists only React, TanStack
  Start/Router/Query, Tailwind and Vite — no component library.

## Target architecture

```
packages/shared-contracts/src/
  change.ts                          # ChangeSchema, ChangeStatusSchema, CreateChangeSchema
  index.ts                         # + export

server/backend/src/
  schema/graph-schema.ts           # + Change node table
  changes/
    changes.repository.ts            # list / findById / create (guarded on key) / count
    changes.service.ts               # DuplicateChangeKeyError, seedIfEmpty(examples)
    example-changes.ts               # the three seed rows
  ui/changes/changes.routes.ts         # GET /, GET /:id, POST /
  ui/ui.routes.ts                  # + .route('/changes', …), UiDeps.changesService
  app.ts                           # + changesService in AppDeps
  main.ts                          # wire ChangesService; seed after ensureSchema when the table is empty

server/frontend/
  postcss.config.cjs               # postcss-preset-mantine + simple-vars
  vite.config.ts                   # drop tailwindcss()
  src/
    styles.css                     # @mantine/core/styles.css + raleway import
    theme.ts                       # createTheme: brand ramp, Raleway, radius
    api/
      client.ts                    # hc<AppType>('/') typed RPC client
      changes.ts                     # queryOptions: changesList, changeById; useCreateChange
    components/
      shell/
        shell-layout.tsx           # AppShell: header 56, navbar 280, breakpoint md
        shell-header.tsx           # burger, mark, color-scheme toggle
        sidebar.tsx                # picker + 4 NavLinks + pinned zone
        change-picker.tsx            # Menu over a Button: changes list + "New change"
        change-status.ts             # CHANGE_STATUS_META: label + badge colour per status
        new-change-modal.tsx         # Modal with name + key, POST, invalidate, navigate
        view-header.tsx            # Breadcrumbs + Title
        last-change.ts               # read/write noesis.shell.lastChangeId
      views/                       # one tiny component per route (route files export only Route)
        overview.tsx  documents.tsx  conversations.tsx  design-docs.tsx
        system-model.tsx  wiki.tsx  change-not-found.tsx  no-changes.tsx
    routes/
      __root.tsx                   # Outlet + devtools (MantineProvider is in main.tsx)
      _shell.tsx                   # loader: ensureQueryData(changesList); renders ShellLayout
      _shell/index.tsx             # beforeLoad: redirect to last/first change, or NoChanges
      _shell/system-model.tsx      # staticData.breadcrumb = ['Documentation','System model']
      _shell/wiki.tsx
      _shell/changes/$changeId.tsx     # loader: ensureQueryData(changeById); writes lastChangeId; Outlet
      _shell/changes/$changeId/index.tsx           # Overview
      _shell/changes/$changeId/documents.tsx
      _shell/changes/$changeId/conversations.tsx
      _shell/changes/$changeId/design-docs.tsx
```

### Key mechanisms

- **Active change in the sidebar.** `useParams({ strict: false }).changeId`
  wins; otherwise `lastChangeId` from `localStorage`; otherwise the first change.
  Sidebar links are built from that id, so the four entries work from
  `/wiki` too.
- **Breadcrumbs.** `useMatches()` + `staticData.breadcrumb`. The change layout
  route contributes `['Changes', change.name]` from its loader data; leaf routes
  contribute their view name. `ViewHeader` reads the accumulated list; no
  hand-maintained map.
- **Data.** TanStack Query `queryOptions` keyed `['changes']` and
  `['changes', id]`; route loaders `ensureQueryData` so the picker never
  flashes empty. Create → invalidate `['changes']` → navigate to the new change.
- **Guarded create.** `MERGE`-free conditional write, the pattern
  `InboxRepository` uses for its state transitions: `CREATE` only when no
  `Change` with that `key` exists, in one statement;
  a null result means duplicate → service throws `DuplicateChangeKeyError` →
  route returns 409.
- **Seed.** `ChangesService.seedIfEmpty(EXAMPLE_CHANGES)` is called from
  `main.ts` after `ensureSchema()`; idempotent because it checks `count()`
  first. Tests exercise it directly against the shared in-memory DB.
- **Providers.** `MantineProvider` and the colour-scheme manager wrap
  `RouterProvider` in `main.tsx`, beside the existing `QueryClientProvider`;
  `ColorSchemeScript` is a `<script>` in `index.html`. Route files export only
  `Route`, so view components live under `components/` (biome's
  `useComponentExportOnlyModules` rejects unexported components there too).

## Plan

1. **Contracts.** Add `packages/shared-contracts/src/change.ts`
   (`CHANGE_STATUSES` tuple in lifecycle order, `ChangeStatusSchema` =
   `z.enum(CHANGE_STATUSES)`, `ChangeSchema`, `CreateChangeSchema` with key regex
   `^[A-Z]{2,8}-\d+$`), export from the package index, unit spec.
2. **Backend.** Schema table; `ChangesRepository` (list newest-first,
   findById, guarded create, count, insertMany for seed); `ChangesService`
   with `DuplicateChangeKeyError` and `seedIfEmpty`; `example-changes.ts`;
   `ui/changes/changes.routes.ts`; wire into `ui.routes.ts`, `app.ts`, `main.ts`.
   Unit specs: repository (duplicate key, ordering), routes (200/201/400/404/
   409), seed idempotency. Extend `test/e2e/app.e2e.spec.ts` deps with the
   new service.
3. **Frontend styling switch.** Remove `tailwindcss`, `@tailwindcss/vite`;
   add Mantine packages, PostCSS config, `theme.ts`, Raleway; rewrite
   `styles.css`; `ColorSchemeScript` as a `<script>` in `index.html`,
   `MantineProvider` around `RouterProvider` in `main.tsx`.
4. **API client + queries.** `api/client.ts` (`hc<AppType>`), `api/changes.ts`
   query options and create mutation.
5. **Routes.** Pathless `_shell` layout, change layout with loader, six leaf
   routes with `staticData.breadcrumb`, index redirect, not-found and
   no-changes states. Delete `components/home.tsx`. Regenerate `routeTree.gen.ts`.
6. **Shell components.** `ShellLayout` (AppShell), `ShellHeader`, `Sidebar`
   (NavLink ×4, pinned zone), `ChangePicker` (Menu), `NewChangeModal`
   (Mantine form primitives, no TanStack Form yet), `ViewHeader`.
7. **Docs.** `docs/stack.md`: Mantine and `@tabler/icons-react` added,
   Tailwind removed. `docs/decisions.md` entry 67: Mantine as the component
   library and Tailwind's removal, re-expressing decision 60's palette as a
   Mantine theme (decision 66 already retired the shadcn/tweakcn stack, so
   there is nothing left to supersede); entry 68: `Change` as a top-level
   entity with its seed policy. This file's status → implemented.
8. **Verify.** `bun run lint && bun run check-types && bun run test`, then
   `bun run dev:server` and the manual checklist.

## Out of scope

- Content of any view (lists, tables, editors). Counts in the sidebar.
- Change status changes, delete, rename.
- Desktop icon-collapse, command palette, search, notifications, right panel.
- Attaching existing design docs to changes.

## Open questions (defaults chosen; say so if different)

- **Change key**: entered by the user in the create modal and validated
  unique. Alternative: server-generated `NOE-<n>` counter. Default: user
  entered.
- **Seed trigger**: boot-time whenever the table is empty. This does mean a
  real first run starts with three example changes. Alternatives: an explicit
  `POST /internal/seed`, a CLI script, or a new env variable — the last one
  reintroduces configuration decision 65 just removed. Default: boot-time.
- **Change colour** in the picker swatch: derived from the key hash on the
  client, not stored. Default: derived.

## Verification

- Manual: open `/` → lands on last/first change Overview; switch changes in the
  picker → URL and breadcrumbs update; four entries and both documentation links
  navigate and highlight; reload keeps the last change; `/wiki` keeps the
  picker populated; create a change → appears first in the picker and is
  selected; duplicate key shows the 409 message inline; narrow viewport shows
  burger + drawer; dark/light toggle persists.
- Automated: contract spec, repository spec, routes spec, seed spec; `lint`,
  `check-types`, `test` green.
