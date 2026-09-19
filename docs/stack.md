# Tech Stack

## Frontend

`server/frontend` — what the app actually depends on today. Additions land
here when something in the tree imports them, not before (decision D5).
The service, contracts and tooling stack is in the root `README.md`.

- **React 19** — UI framework; `main.tsx` is the single browser entry, a
  client-only SPA with no SSR and no server functions (decision D5)
- **Mantine** (`@mantine/core`, `@mantine/hooks`, `@mantine/form`) —
  component library, theme and forms: `MantineProvider` at the root with the
  brand theme from `src/theme.ts`, `@mantine/core/styles.css` imported from
  `main.tsx`, `styles.css` keeps only what Mantine does not set (decision
  D5)
- **@tabler/icons-react** — the icon set Mantine's own docs use
- **Raleway** (`@fontsource-variable/raleway`) — the brand typeface,
  imported from `main.tsx`; bun inlines the font files into the page's CSS
- **Contracts** (`server/backend/src/app/*/model/`) — the zod contracts
  both sides share; the frontend takes its payload types from them
  (type-only, via the `#backend/*` alias) and calls `/ui` through Hono's
  typed RPC client, `hc<AppType>('/ui')` in `src/api/client.ts`, with
  `AppType` a type-only import from the backend via the `#backend/*` alias
  (decision D5)
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
  the service uses the same library (decision D10, `docs/logging.md`)
- **bun** — bundler of the shipped page (decision D5): the backend imports
  `index.html`, bun bundles the scripts and styles it references, and on
  build emits them ahead of time into the service's `dist/`. Run from source
  without Vite, the service bundles the page on request with hot module
  reload off (refresh after an edit). No Tailwind, no React Compiler, no
  router plugin: the package has no production build of its own
- **Vite** (`vite`, `@vitejs/plugin-react`) — the development server only
  (`vite.config.ts`, decision D5): `127.0.0.1:3000` with React Fast Refresh,
  proxying `/ui` and `/internal` to the backend on `:3001`; root
  `bun run dev` (`server/scripts/dev.ts`) runs both. Vite never produces the
  shipped bundle

What the backend serves the SPA from and how the `/ui` surface is typed is
described in `server/backend/README.md` and `server/frontend/README.md`.
