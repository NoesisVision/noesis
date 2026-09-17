---
type: chore
scope: server
status: adopted
created: 2026-09-12
---

# Spike: serve the SPA through bun's fullstack bundling

## Question

Can the service drop Vite and the `ui/` copy step by importing the frontend's
`index.html` and letting `bun build` bundle the browser app into `dist/`
(bun's fullstack production mode)? Tailwind is retired at the same time;
Mantine is the component library from here on.

## Result: yes, with two workarounds

Branch `spike/bun-fullstack`. `bun run ci` green: backend 170 unit and 15
e2e, plugin 8, lint, types.

What the branch does:

- `server/backend/src/main.ts` imports `../../frontend/index.html` and hands
  it to `Bun.serve` as the `/*` route, with `/ui/*` and `/internal/*` routed
  to the Hono app first (bun matches by specificity, so a surface 404 is
  never swallowed by the page). `development` is on from source (HMR, page
  bundled on first request in ~35 ms) and off in the built bin.
- `bun run build` in the backend is one command:
  `bun build src/main.ts --outdir dist --target bun --production ...` emits
  `main.js`, `index.html`, one hashed JS and one hashed CSS asset. `files` is
  `dist`. No `build:ui`, no `ui/`, no `UI_DIST_PATH`, no `serveStatic`.
- The frontend package has no build, no `vite.config.ts`, no Vite, Tailwind,
  Babel or React Compiler dependency. `tsr generate` writes the route tree.
  Mantine is wired in (`MantineProvider`, `@mantine/core/styles.css`).
- `scripts/dev-server.sh` is gone; `bun run dev` is the service on `:3000`
  serving the SPA with HMR. `PORT` stays as a stable dev URL, nothing else
  needs it.
- Tests: the SPA e2e boots from source and checks the page, client routes,
  absolute asset links and the surfaces; the pack spec boots the built bin
  from another directory and fetches the page and a script.

## Findings the plan did not foresee

1. **Output layout.** With entry points in two packages, `bun build` places
   the HTML output relative to the common root, which put it at
   `../../frontend/index.html` from `dist/` — on top of the source file.
   `--entry-naming '[name].[ext]'` flattens every entry into `dist/`.
2. **Asset URLs.** By default the page links assets as `./index-<hash>.js`,
   which a deep client route (`/changes/x`) resolves under its own path and
   gets the page back. `--public-path /` makes the links absolute.
3. **Working directory.** The built bin resolves its bundle manifest against
   the process working directory, not against `main.js`, and dies at
   `Bun.serve` when launched from anywhere but `dist/` — and `bunx` launches
   it from the user's project. `src/bundle-cwd.ts` records the launch
   directory (repository-root discovery uses it) and `chdir`s to the bundle
   before the server starts; it is `main.ts`'s first import.
4. **`--production` under `bun test`.** `--production` sets
   `NODE_ENV=production` only when the environment has none; the test runner
   exports `NODE_ENV=test`, which then leaks into the bundle (`development`
   true, the `chdir` compiled out). The build script sets
   `NODE_ENV=production` explicitly.
5. **TanStack Router code splitting** was the Vite plugin's; `tsr generate`
   keeps the route tree, routes are no longer split. At the current size
   (one 0.6 MB JS asset with Mantine and devtools) this is not a concern;
   `lazyRouteComponent` is the manual path if it becomes one.
6. **React Compiler** is gone with Babel. Nothing in the tree relied on it.
7. **Hot module reload breaks the page** (found after adoption, when the
   page was first opened in a browser rather than curled). Bun's HMR client
   runtime evaluates the circular import between `router.js` and
   `load-client.js` in `@tanstack/router-core` to a null namespace and the
   page dies at load with "Cannot read properties of null (reading
   'replaceRouteChunk')", on bun 1.3.14 and 1.4.2 alike. The dev bundler
   without HMR (`development: { hmr: false }`) and the production bundle
   evaluate the same cycle correctly, so the service runs from source with
   `hmr: false`: the page is rebundled on the next request after an edit,
   at the cost of a manual refresh. Tracked upstream as
   [oven-sh/bun#40378](https://github.com/oven-sh/bun/issues/40378) (this
   exact TanStack Router error) and
   [oven-sh/bun#40248](https://github.com/oven-sh/bun/issues/40248) (the
   underlying import-cycle defect, with a dependency-free reproduction);
   the fix is
   [oven-sh/bun#40259](https://github.com/oven-sh/bun/pull/40259), open and
   unreleased as of 2026-09-17. Once it ships, turn `hmr` back on and
   retest.

## Outcome

Adopted on 2026-09-12 as decision 72 and merged into the architecture
branch.
