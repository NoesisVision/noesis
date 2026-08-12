# Feature Plan: UI Shell

**Status:** implemented (2026-08-12) — architecture recorded as decision 45 in
[`docs/decisions.md`](../../decisions.md)
**Prototype:** [`ui-shell-prototype.html`](./ui-shell-prototype.html) — static
single-file HTML mock of the shell (open in a browser); demonstrates the
sidebar with project selector, bottom-pinned Settings, top bar, contextual
right panel with selection inspector, command palette, theming, and the
`noesis.shell.*` persistence keys.
**Goal:** Build the application shell for `server/frontend`: a collapsible left
sidebar navigating between views, a top bar with breadcrumbs and a global
command palette, and a contextual right panel whose content is driven by the
active route plus the current selection in the main section. Views themselves
ship as placeholders — each real view is a separate feature.

## Requirements (agreed 2026-08-12)

### Left sidebar

- Sidebar header is a **project selector** (IntelliJ-style): shows the current
  project's name and logo mark; clicking opens a dropdown listing existing
  projects (current one checked) plus an **add new project** entry. Switching
  updates the shell context (header + breadcrumb root). Backing
  project storage/CRUD is out of scope here — the shell exposes the switcher
  UI over whatever project source exists.
- Navigation buttons for the initial views: **Dashboard/Home** (`/`),
  **Graph/Canvas** (`/graph`), **Documents** (`/documents`),
  **Settings** (`/settings`).
- **Settings is pinned to the bottom** of the sidebar in its own group
  (separated by a border), above the sidebar footer; the other views stay in
  the top group.
- Collapsible to **icon mode** (shadcn Sidebar `collapsible="icon"`), toggled
  by a top-bar button and **Cmd+B**; collapsed state persisted.
- On mobile the sidebar becomes an off-canvas sheet (shadcn Sidebar built-in).

### Right panel

- Content is **route-driven and selection-refined**: each route registers its
  panel content; when the user selects something in the main section, the
  panel switches to an inspector for that selection.
- **Resizable** via drag handle and **collapsible**; width and open/closed
  state persisted **per view**.
- Hidden on mobile (no bottom-sheet work in this feature).

### Top bar

- Left: sidebar toggle, route-derived **breadcrumbs**.
- Right: **command palette trigger** (button showing `⌘K`), **theme toggle**
  (light/dark, Claude tweakcn theme), **notifications** bell with a
  placeholder popover. No user menu (no auth yet).

### Global search / command palette

- **Cmd+K** opens a command dialog. Two client-side groups work immediately:
  **navigation** (jump to any view) and **actions** (toggle sidebar, toggle
  theme, toggle right panel).
- An **entities** group queries a backend search endpoint via the typed `hc`
  RPC client. The endpoint ships now but **returns no results** — there are no
  searchable entities yet. When entities (documents, graph nodes, projects)
  land, they plug into the server-side provider registry; the palette UI does
  not change.

### Responsive scope

Desktop-first. Mobile gets the built-in sidebar sheet and a hidden right
panel; no further mobile polish.

### Component sourcing

Start from a **Shadcnblocks pre-built app-shell/sidebar block** and adapt it,
per stack.md. Fill gaps with shadcn (Base UI, base-nova style) primitives.

## Guiding facts

- `server/frontend` already has: TanStack Router (file-based, routes in
  `src/routes/`), TanStack Query wired in `main.tsx`, shadcn configured
  (`components.json`, base-nova style, lucide icons, Claude theme in
  `src/index.css`), typed RPC client in `src/client.ts`.
- Current routes (`__root.tsx`, `index.tsx`, `about.tsx`) are scaffold
  placeholders — free to restructure.
- The backend composes one Hono sub-app per consumer surface (decision in
  `app.ts`); the shell's search endpoint belongs on the **`/ui` surface**
  (`server/backend/src/ui/`). The `.route()` chain must stay unbroken so
  `hc<AppType>` keeps inferring the tree.
- No auth, no user entity — user menu is explicitly out of scope.

## Target architecture

```
server/frontend/src/
  components/
    ui/                      # shadcn primitives (installed, not hand-edited)
    shell/
      shell-layout.tsx       # grid: sidebar | (topbar / main+right-panel)
      app-sidebar.tsx        # nav items (Settings pinned bottom), icon-collapse, active state
      project-selector.tsx   # sidebar-header dropdown: switch/add project
      top-bar.tsx            # toggle, breadcrumbs, palette trigger, theme, bell
      right-panel.tsx        # resizable/collapsible slot host
      shell-provider.tsx     # context: right-panel content, selection, panel state
      command-palette.tsx    # Cmd+K dialog: navigation, actions, entity search
      theme-provider.tsx     # light/dark, class on <html>, persisted
      use-shell-hotkeys.ts   # Cmd+K, Cmd+B (and Cmd+. for right panel)
  routes/
    __root.tsx               # providers only + <Outlet/> (+ devtools)
    _shell.tsx               # pathless layout route rendering <ShellLayout/>
    _shell/
      index.tsx              # Dashboard placeholder
      graph.tsx              # Graph/Canvas placeholder
      documents.tsx          # Documents placeholder
      settings.tsx           # Settings placeholder

server/backend/src/ui/
  search/
    search.service.ts        # SearchProvider registry (empty array today)
    search.routes.ts         # GET /ui/search?q= → { results: SearchResult[] }
```

### Key mechanisms

- **Right panel registration.** `ShellProvider` holds
  `{ panel: ReactNode | null, selection: unknown }`. A route (or any component
  inside it) calls `useRightPanel(node)` (effect-based: registers on mount,
  clears on unmount). Selecting an item in the main section calls the same
  hook with inspector content — last registration wins, so
  selection naturally refines the route default. No router coupling; the
  mechanism is a plain context.
- **Panel sizing.** Wrap main + right panel in shadcn `Resizable`
  (`ResizablePanelGroup` with `autoSaveId` per view id) — persistence of
  widths comes free; open/collapsed state stored in `localStorage` under
  `noesis.shell.rightPanel.<viewId>`.
- **Breadcrumbs.** Derived from `useMatches()` — each shell route exports
  `staticData: { breadcrumb: string }`; no hand-maintained map.
- **Theme.** `ThemeProvider` toggles the `dark` class on `<html>`, persists to
  `localStorage` (`noesis.shell.theme`), defaults to system preference. The
  Claude theme CSS variables already cover both modes.
- **Search contract.** `SearchResult = { type: string; id: string; title:
string; subtitle?: string; href?: string }` (zod schema next to the route,
  exported through `AppType` — the frontend gets types via RPC inference, no
  new contracts package needed). Server keeps a `SearchProvider[]` registry
  (`(q) => Promise<SearchResult[]>`); empty today, entities register later.
  Palette calls it with a debounced TanStack Query keyed on the query string,
  disabled while `q` is empty.

## Plan

1. **Install building blocks.** Pick a Shadcnblocks app-shell/sidebar block as
   the base; add missing shadcn primitives (`sidebar`, `breadcrumb`,
   `command`, `resizable`, `popover`, `dropdown-menu`, `tooltip`, `button`,
   `separator`, `sheet`, `skeleton`).
2. **Restructure routes.** Slim `__root.tsx` to providers + `<Outlet/>`;
   add pathless `_shell.tsx` layout; move `index`, add `graph`, `documents`,
   `settings` placeholders with `staticData.breadcrumb`. Delete `about.tsx`.
3. **Shell layout + sidebar.** `ShellLayout` with shadcn `SidebarProvider`
   (persists collapsed state) + adapted block markup; `AppSidebar` nav items
   with active-route highlighting via router `Link`.
4. **Top bar.** Toggle, breadcrumbs from `useMatches()`, palette trigger,
   `ThemeProvider` + toggle, notifications bell + placeholder popover.
5. **Right panel.** `ShellProvider`, `useRightPanel`, `Resizable` wiring,
   per-view persistence, collapse toggle (button + Cmd+.). Demo registration
   in one placeholder view (e.g. a selectable list on Dashboard) to prove the
   selection-inspector flow.
6. **Backend search.** `search.routes.ts` + provider registry on the `/ui`
   surface, keeping the `.route()` chain unbroken; unit test asserting shape
   and empty results.
7. **Command palette.** `command-palette.tsx` with navigation, actions, and
   the RPC-backed entities group; `use-shell-hotkeys`.
8. **Responsive + polish pass.** Verify mobile sheet, hide right panel below
   `md`, keyboard focus order, tooltips on icon-collapsed sidebar.
9. **Wrap up.** `bun run lint && bun run check-types && bun run test`; record
   a decisions.md entry (shell architecture: pathless layout route, context
   panel registration, `/ui` search surface).

## Out of scope

- Real view content (dashboard widgets, React Flow canvas, BlockNote editor,
  settings forms) — separate features.
- Search entity providers (documents, graph nodes, projects) — added with
  their entities.
- User menu / auth, real notifications, mobile bottom sheet for the right
  panel.

## Verification

- Manual: navigate all four views; collapse/expand + resize survive reload;
  Cmd+K / Cmd+B / Cmd+. work; selection in the demo list swaps the right
  panel; mobile viewport shows the sheet sidebar and no right panel.
- Automated: backend search route unit test; `lint`, `check-types`, `test`
  green in CI.
