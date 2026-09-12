# Tech Stack

## Frontend

`server/frontend` — what the app actually depends on today. Additions land
here when something in the tree imports them, not before (decision 66).

- **React 19** — UI framework
- **Mantine** — component library and theme (`@mantine/core`, `@mantine/hooks`)
- **TanStack Router** — type-safe file-based routing; `tsr generate`
  (`bun run generate-routes`) writes the route tree
- **TanStack Query** — server state, data fetching and caching
- **bun** — bundler and dev server: the backend imports `index.html`, bun
  bundles the scripts and styles it references (on the fly with HMR from
  source, ahead of time into the service's `dist/` on build). A plain
  client-only SPA, no SSR and no server functions (decision 67)
