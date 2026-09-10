# Tech Stack

## Frontend

`server/frontend` — what the app actually depends on today. Additions land
here when something in the tree imports them, not before (decision 66).

- **React 19** — UI framework, with the **React Compiler** babel plugin on
- **TanStack Router** — type-safe file-based routing; `@tanstack/router-plugin`
  generates the route tree and code-splits routes at build time
- **TanStack Query** — server state, data fetching and caching
- **Tailwind CSS v4** — utility-first styling, via `@tailwindcss/vite`
- **Vite 8** — dev server and build; a plain client-only SPA, no SSR and no
  server functions (decision 67)

No component library is in use. The UI is the `create-tsrouter-app` scaffold;
the shell, the theme and a component library are open decisions.
