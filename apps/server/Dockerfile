# syntax=docker/dockerfile:1-labs
# ^ labs frontend for `COPY --parents` (decision 36). Must stay line 1.

# Builds the single production image: the Hono server (bundled, self-contained)
# serving the built ui app (decisions 17/28). Built by Railway via `railway up`
# with the repo root as build context (railway.json's dockerfilePath points here).
# Bun version must match `packageManager` in package.json (and CI).

# --- build stage ----------------------------------------------------------
FROM oven/bun:1.3.14 AS build
WORKDIR /repo

# Workspace manifests first so the install layer caches across source changes.
# The globs mirror `workspaces.packages` in the root package.json.
COPY package.json bun.lock bunfig.toml ./
COPY --parents apps/*/package.json packages/*/package.json plugins/*/package.json ./
RUN bun install --frozen-lockfile

COPY . .
RUN bun run --filter=server --filter=ui build

# @ladybugdb/core is a native module (dlopen'd .node binding), so the server
# bundle marks it external. After install its package dir is self-contained
# (~19 MB: JS wrapper + platform binary copied in by its install script), so
# stage the whole directory — no hand-maintained file list.
RUN mkdir -p /runtime/node_modules/@ladybugdb \
  && cp -RL /repo/apps/server/node_modules/@ladybugdb/core \
    /runtime/node_modules/@ladybugdb/core

# --- runtime stage --------------------------------------------------------
FROM oven/bun:1.3.14-slim
WORKDIR /app

COPY --from=build /repo/apps/server/dist ./server
COPY --from=build /repo/apps/ui/dist ./ui
# require("@ladybugdb/core") from server/main.js resolves up to /app/node_modules.
COPY --from=build /runtime/node_modules ./node_modules

ENV NODE_ENV=production
ENV UI_DIST_PATH=/app/ui

# Writable home for the on-disk LadybugDB (the default `.data` would land in
# root-owned /app). A Railway volume is mounted here for persistence across
# deploys — but Railway mounts volumes root-owned, shadowing any image chown.
# So CMD starts as root, fixes the mount's ownership, and drops to bun.
RUN mkdir -p /data
ENV NOESIS_DATA_DIR=/data

EXPOSE 3000
CMD ["sh", "-c", "chown bun:bun /data && exec setpriv --reuid bun --regid bun --init-groups bun server/main.js"]
