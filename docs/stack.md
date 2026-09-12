# Tech Stack

## Frontend

`server/frontend` — what the app actually depends on today. Additions land
here when something in the tree imports them, not before (decision 66).
The service, contracts and tooling stack is in the root `README.md`.

- **React 19** — UI framework; `main.tsx` is the single browser entry, a
  client-only SPA with no SSR and no server functions (decision 67)
- **Mantine** (`@mantine/core`, `@mantine/hooks`) — component library and
  theme: `MantineProvider` at the root, `@mantine/core/styles.css` imported
  from `main.tsx`, `styles.css` keeps only what Mantine does not set
  (decision 72)
- **TanStack Router** — type-safe file-based routing; `tsr generate`
  (`bun run generate-routes`, `@tanstack/router-cli`) writes the committed
  `src/routeTree.gen.ts`. Routes are not code-split; `lazyRouteComponent` is
  the manual path if the bundle grows
- **TanStack Query** — server state, data fetching and caching, wired in
  `src/integrations/tanstack-query/`
- **TanStack devtools** (`@tanstack/react-devtools` with the Router and
  Query panels) — mounted from the root layout
- **bun** — bundler and dev server (decision 72): the backend imports
  `index.html`, bun bundles the scripts and styles it references. From
  source the page is bundled on request with hot module reload off (refresh
  after an edit); on build it is emitted ahead of time into the service's
  `dist/`. No Vite, no Tailwind, no React Compiler, no router plugin: the
  package has no build of its own

What the backend serves the SPA from and how the `/ui` surface is typed is
described in `server/backend/README.md` and `server/frontend/README.md`.
