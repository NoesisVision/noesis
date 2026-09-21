# Tech Stack

What `server/backend` and `server/frontend` actually depend on today, and why
each is there. Additions land here when something in the tree imports them,
not before (decision D5). Repo-wide tooling (linting, formatting, hooks, CI,
Renovate) is in [`README.md`, section 2](../README.md#2-tools).

## Backend

`server/backend` — the service, `@noesis-vision/noesis`. How the pieces fit is
in [`README.md`](../README.md), "The service"; the layer rules are in
[`AGENT.md`](../AGENT.md).

- **bun** — runtime (runs the TypeScript source directly), `Bun.serve` for
  HTTP, bundler of `dist/main.js` and of the SPA page, test runner
- **Hono 4** (`hono`, `@hono/standard-validator`) — the `/ui` and `/internal`
  surfaces on `Bun.serve`; `sValidator` checks a route's payload against its
  zod schema, and the unbroken `.route()` chain keeps the tree inferable for
  the frontend's `hc` client (decision D5)
- **zod 4** (`^4.2.0` floor) — contract schemas, whose inferred types are the
  domain model (decision D4), and env validation; below 4.2 the MCP SDK drops
  `.describe()` from advertised schemas
- **MCP SDK v2** (`@modelcontextprotocol/server`; `@modelcontextprotocol/client`
  in tests only) — `McpServer` with one module per tool, stdio via
  `serveStdio` on the 2026-07-28 revision and the 2025 era (decision D3)
- **LadybugDB** (`@ladybugdb/core`) — embedded graph database, in memory
  only, the cache over `.noesis/` (decisions D1 and D3); a native module and
  the package's one runtime dependency, everything else is bundled
- **LogTape** (`@logtape/logtape`, `@logtape/file`, `@logtape/hono`) —
  logging to stderr and `.noesis/logs/noesis.log`, plus request logging on
  the Hono app (decision D10, [`docs/logging.md`](logging.md))
- **uuid** — v7 ids; code reachable from `AppType` must stay runtime-neutral,
  so not `Bun.randomUUIDv7()`
- **TypeScript 7** — checked by the native (Go) compiler, `tsc --noEmit` only
  (decision D7)

## Frontend

`server/frontend` — the SPA, bundled and served by the service.

Elsewhere, and not repeated here:

- how the `/ui` surface is typed and where the shared contracts live —
  [`README.md`](../README.md), "Contracts"
- the frontend rules the linter enforces —
  [`AGENT.md`](../AGENT.md#frontend-serverfrontend-decision-d5)
- the package's scripts and layout —
  [`server/frontend/README.md`](../server/frontend/README.md)

The dependencies:

- **React 19** — UI framework; `main.tsx` is the single browser entry, a
  client-only SPA with no SSR and no server functions
- **Mantine** (`@mantine/core`, `@mantine/hooks`, `@mantine/form`) —
  component library, theme and forms: `MantineProvider` at the root with the
  brand theme from `src/theme.ts`, `@mantine/core/styles.css` imported from
  `main.tsx`, `styles.css` keeps only what Mantine does not set
- **@tabler/icons-react** — the icon set Mantine's own docs use
- **clsx** (`cx`) — joins CSS module class names where a component takes
  more than one, as the sidebar's nested links do
- **Raleway** (`@fontsource-variable/raleway`) — the brand typeface,
  imported from `main.tsx`; bun inlines the font files into the page's CSS
- **Hono's typed RPC client** (`hono/client`) — `hc<AppType>('/ui')` in
  `src/api/client.ts`; `AppType` and the payload types are type-only imports
  from the backend via the `#backend/*` alias
- **TanStack Router** — type-safe file-based routing; `tsr generate`
  (`bun run generate-routes`, `@tanstack/router-cli`) writes the committed
  `src/routeTree.gen.ts`. Routes are not code-split; `lazyRouteComponent` is
  the manual path if the bundle grows
- **TanStack Query** — server state, data fetching and caching, wired in
  `src/integrations/tanstack-query/`
- **TanStack devtools** (`@tanstack/react-devtools` with the Router and
  Query panels) — mounted from the root layout
- **LogTape** (`@logtape/logtape`) — logging to the browser console under
  `noesis.ui.*`, configured once in `src/logging.ts` before the app renders;
  the service uses the same library (decision D10,
  [`docs/logging.md`](logging.md))
- **bun** — bundler of the shipped page: the backend imports `index.html`,
  bun bundles the scripts and styles it references, and on build emits them
  ahead of time into the service's `dist/`. Run from source without Vite, the
  service bundles the page on request with hot module reload off (refresh
  after an edit). No Tailwind, no React Compiler, no router plugin: the
  package has no production build of its own
- **Vite** (`vite`, `@vitejs/plugin-react`) — the development server only
  (`vite.config.ts`): `127.0.0.1:3000` with React Fast Refresh, proxying
  `/ui` and `/internal` to the backend on `:3001`; root `bun run dev`
  (`server/scripts/dev.ts`) runs both. Vite never produces the shipped bundle
