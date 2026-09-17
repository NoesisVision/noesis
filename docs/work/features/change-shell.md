---
type: feat
scope: server
status: implemented
created: 2026-09-09
implemented: 2026-09-13
---

# Feature Plan: Change-scoped app shell (Mantine, option C sidebar)

**Status:** implemented (2026-09-13) — architecture recorded as decision D5 in
[`docs/decisions.md`](../../decisions.md). Two things landed differently from
the plan below: the frontend calls `/ui` over plain `fetch` typed by
`@repo/shared-contracts` rather than `hc<AppType>` (archived decision 74:
importing the route type drags the service's module graph into the frontend's
type program; now `hc<AppType>`, see D5), and the key is optional (the
contract's "empty when there is none").
**Prototype:** [`change-shell-prototype.html`](./change-shell-prototype.html) —
static mock of three sidebar structures; **option C ("Flat + pinned")** is the
one being built. Options A and B stay in the file for reference.
**Goal:** Give `server/frontend` (a client-only React SPA on TanStack Router,
bundled and served by the service through bun's fullstack mode — decision
D5) a real application shell: a left sidebar with a **change
picker** on top, four flat change-scoped entries below it, and a pinned bottom
zone with the change-independent **System model** and **Wiki** links. A small
change backend supplies the picker. Every content view renders only breadcrumbs
and the view name; real content is later work.

## Requirements (agreed 2026-09-09)

### Terminology

- **Change** — the unit of work the sidebar is scoped to (was "task" in the
  first mockup). Users see "Change", "Changes", "New change".
- **Documentation** — the change-independent area: System model and Wiki
  (was "Workspace"). Used as sidebar section label and breadcrumb root.
- **Change type** — `feature | fix | improvement | chore`, the commit-message
  vocabulary of decision D7 with `feat` spelled out as `feature` (a stored
  value read by people, not a 72-char subject prefix). A change is the work
  behind one or more commits of the matching type; `feature` ↔ `feat`.

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

- A change is the directory `.noesis/changes/<change>/` in the checkout the
  server serves (decision D2): listing is a directory read, creation is a
  directory write, and there is no seed — a first run starts with no changes
  and the empty state below. Nothing about a change lives in the LadybugDB
  graph; the graph is a cache over the files.
- The directory name is the change's slug: lower-case kebab-case
  (`^[a-z0-9]+(-[a-z0-9]+)*$`, at most 64 characters), so it is safe as a path
  and reads in a diff. It is the `$changeId` of the routes above.
- Landed with the migration's R1 (`ChangesRepository`, `ChangesService`,
  `ui/changes/changes.routes.ts`): `GET /ui/changes` lists
  `{ changes: [{ slug }] }` sorted by slug, `POST /ui/changes` with
  `{ slug }` creates the directory and answers 201; a slug that already exists
  is 409 `{ error: 'duplicate_change' }`, an invalid body 400. Design docs hang
  under the change at `/ui/changes/:change/design-docs`, and a change with no
  directory is 404 `{ error: 'change_not_found' }` there.
- The metadata shape already exists as the `change` contract
  (`packages/shared-contracts/src/change.ts`, landed with the migration's R5):
  `ChangeSchema` with `slug`, `name`, `key` (e.g. `NOE-142`), `type`
  (`CHANGE_TYPES` tuple `feature | fix | improvement | chore`, the commit-type
  vocabulary of decision D7 with `feature` as the long form of `feat`),
  `status` (`CHANGE_STATUSES` tuple `discovery | design | implementation |
done`, kept in lifecycle order so later sorting and "advance" actions need
  no second list), `created_at` and `description`. It is the `change.json`
  file in the change directory.
- Still to do for this feature: a `CreateChangeSchema` in the same contract
  file; the backend reading and writing `change.json` (`ChangesRepository`
  and `ChangesService` handle the bare directory today, and the list answers
  `{ slug }` only); the create endpoint taking `{ name, key, type }`, deriving
  the slug from the name, starting the status at `discovery`, and keeping 409
  for a slug or key that is taken; `GET /ui/changes/:id`; newest-first
  listing ordered by `created_at`.
- Status badge colours (picker and future lists): `discovery` gray,
  `design` violet, `implementation` brand blue, `done` green. One
  `CHANGE_STATUS_META` map in the frontend owns label + colour per status.
- Type shown as a small outline badge next to the key: `feature` green, `fix`
  red, `improvement` teal, `chore` gray. `CHANGE_TYPE_META` map beside the
  status one.

### Styling

- **Mantine** is already the component library (decision D5): `@mantine/core`,
  `@mantine/hooks` and `@mantine/form` are installed, `MantineProvider` wraps
  the app in `main.tsx`, `@mantine/core/styles.css` is imported there, and
  Tailwind and Vite are gone. This feature adds `@tabler/icons-react`. There
  is no PostCSS pipeline: bun bundles the CSS `index.html` references as is,
  so styles use Mantine's style props and CSS modules, not
  `postcss-preset-mantine` mixins.
- Theme: `createTheme` with `primaryColor: 'brand'` — a 10-step ramp derived
  from the noesis.vision `blue-700` (archived decision 60's palette, kept as
  brand guidance by decision D5), `fontFamily`
  Raleway via `@fontsource-variable/raleway`, `defaultRadius: 'sm'`.
  Everything else Mantine default.
- Colour scheme `auto` by default, persisted by Mantine's
  `localStorageColorSchemeManager` under key `noesis.shell.colorScheme`.

### Auth

- There is none, anywhere: decision D1 removed authentication, sessions and
  the `/auth` surface. The frontend has no session guard and no login route,
  and nothing in this feature reintroduces a trust boundary.

## Guiding facts

- Frontend today: bare scaffold (`__root.tsx`, `index.tsx`,
  `components/home.tsx`, `components/root-layout.tsx`) on Mantine, TanStack
  Query wired in `integrations/tanstack-query/`, no build of its own — the
  backend imports `index.html` and bun bundles it (decision D5). No React
  Compiler, no route splitting. `tsr generate` writes `routeTree.gen.ts`.
  Free to restructure.
- Nothing renders outside the browser (decision D5 dropped TanStack Start),
  so Mantine's `ColorSchemeScript` goes in `index.html` and `localStorage` may
  be read anywhere. `main.tsx` is the entry: `MantineProvider` and
  `QueryClientProvider` already wrap `RouterProvider` there, not in the root
  route.
- Backend: one Hono sub-app per surface (`app.ts`); `/ui` routes are typed
  through `hc<AppType>` from `backend/client`. The `.route()` chain must stay
  unbroken. The knowledge graph files under `.noesis/` are the source of
  truth (decision D1): a `FileRepository` per kind owns its directory, and
  the `GRAPH_SCHEMA` graph is a cache to be rebuilt from them. Ids come from
  `@repo/shared-contracts/uuid`.
- Changes and design docs already follow the directory layout
  (`ChangesRepository`, `DesignDocsRepository` over
  `changes/<change>/design-docs/`). The inbox is gone. The repository root is
  `NOESIS_ROOT` or the nearest `.git` above the working directory.
- The decision log's numbering ended at 73 at the time (now archived).
  Archived decision 66 retired the old frontend stack and left the component
  library open; decision D5 chose Mantine, so `docs/stack.md` lists React,
  Mantine, TanStack Router/Query and bun. The frontend does not yet depend on
  `backend` or `@repo/shared-contracts` and calls no endpoint.

## Target architecture

```
packages/shared-contracts/src/
  change.ts                          # ChangeSchema, ChangeStatusSchema, ChangeTypeSchema, CreateChangeSchema
  index.ts                         # + export

server/backend/src/
  changes/
    changes.repository.ts            # exists: list (readdir) / exists / create (mkdir); + metadata file read/write
    changes.service.ts               # exists: DuplicateChangeError, ChangeNotFoundError; + metadata on create
  ui/changes/changes.routes.ts         # exists: GET /, POST /; + GET /:id, metadata in the body
  ui/ui.routes.ts                  # exists: .route('/changes', …), UiDeps.changesService
  app.ts                           # exists: changesService in AppDeps
  main.ts                          # exists: ChangesService wired over `.noesis/`; no seed

server/frontend/
  index.html                       # + ColorSchemeScript
  src/
    main.tsx                       # exists: MantineProvider + QueryClientProvider; + theme, colour-scheme manager
    styles.css                     # exists: what Mantine does not set; + raleway import
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
        change-status.ts             # CHANGE_STATUS_META + CHANGE_TYPE_META: label + badge colour
        new-change-modal.tsx         # Modal: name, key, type (SegmentedControl); POST, invalidate, navigate
        view-header.tsx            # Breadcrumbs + Title
        last-change.ts               # read/write noesis.shell.lastChangeId
      views/                       # one tiny component per route (route files export only Route)
        overview.tsx  documents.tsx  conversations.tsx  design-docs.tsx
        system-model.tsx  wiki.tsx  change-not-found.tsx  no-changes.tsx
    routes/
      __root.tsx                   # exists: Outlet + devtools via components/root-layout.tsx
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
- **Guarded create.** A change exists when its directory does: the
  repository lists `changes/` and refuses a slug that is taken, and the service
  throws `DuplicateChangeError` → route returns 409. With metadata the same
  check covers the key.
- **No seed.** A checkout with no `changes/` directory has no changes; the
  index route's empty state is the first-run experience.
- **Providers.** `MantineProvider` and the colour-scheme manager wrap
  `RouterProvider` in `main.tsx`, beside the existing `QueryClientProvider`;
  `ColorSchemeScript` is a `<script>` in `index.html`. Route files export only
  `Route`, so view components live under `components/` (biome's
  `useComponentExportOnlyModules` rejects unexported components there too).

## Plan

1. **Contracts.** `packages/shared-contracts/src/change.ts` already has
   `CHANGE_STATUSES`, `CHANGE_TYPES`, their schemas and `ChangeSchema`, and
   is exported from the package index. Add `CreateChangeSchema` with `type`
   required and key regex `^[A-Z]{2,8}-\d+$`, plus a unit spec (the file
   has none).
2. **Backend.** Extend the existing `ChangesRepository` with the metadata
   file (read on list and findById, written on create), `ChangesService.create`
   with `{ name, key, type }`, `GET /ui/changes/:id`. Unit specs: repository
   (duplicate slug and key, newest-first ordering), routes (200/201/400/404/
   409). No seed, no schema table.
3. **Theme.** Mantine is already in (decision D5). Add `@tabler/icons-react`
   and Raleway, `theme.ts`, the colour-scheme manager on the existing
   `MantineProvider` in `main.tsx`, `ColorSchemeScript` as a `<script>` in
   `index.html`.
4. **API client + queries.** `api/client.ts` (`hc<AppType>`), `api/changes.ts`
   query options and create mutation.
5. **Routes.** Pathless `_shell` layout, change layout with loader, six leaf
   routes with `staticData.breadcrumb`, index redirect, not-found and
   no-changes states. Delete `components/home.tsx`. Regenerate `routeTree.gen.ts`.
6. **Shell components.** `ShellLayout` (AppShell), `ShellHeader`, `Sidebar`
   (NavLink ×4, pinned zone), `ChangePicker` (Menu), `NewChangeModal`
   (name, key, type; `@mantine/form`, already installed), `ViewHeader`.
7. **Docs.** `docs/stack.md`: add `@tabler/icons-react` and Raleway. A
   `docs/decisions.md` entry for the shell itself: the change-scoped sidebar,
   the `_shell` layout route, and archived decision 60's palette re-expressed
   as a Mantine theme (decision D5 already records Mantine as the component
   library and Tailwind's removal; decision D2 already records a change as a
   directory under `.noesis/changes/`). This file's status → implemented.
8. **Verify.** `bun run lint && bun run check-types && bun run test`, then
   `bun run dev` in `server/backend` and the manual checklist.

## Out of scope

- Content of any view (lists, tables, editors). Counts in the sidebar.
- Change status changes, delete, rename.
- Desktop icon-collapse, command palette, search, notifications, right panel.
- Attaching existing design docs to changes.

## Open questions (defaults chosen; say so if different)

- **Change key**: entered by the user in the create modal and validated
  unique. Alternative: server-generated `NOE-<n>` counter. Default: user
  entered.
- **Change colour** in the picker swatch: derived from the key hash on the
  client, not stored. Default: derived.

## Verification

- Manual: open `/` → lands on last/first change Overview; switch changes in the
  picker → URL and breadcrumbs update; four entries and both documentation links
  navigate and highlight; reload keeps the last change; `/wiki` keeps the
  picker populated; create a change → appears first in the picker and is
  selected; duplicate key shows the 409 message inline; narrow viewport shows
  burger + drawer; dark/light toggle persists.
- Automated: contract spec, repository spec, routes spec; `lint`,
  `check-types`, `test` green.
