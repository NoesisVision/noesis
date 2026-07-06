# Builds the single production image: the NestJS server (bundled, self-contained)
# serving the built ui app (decision 17). Built by Railway via `railway up`.
# Bun version must match `packageManager` in package.json (and CI).

# --- build stage ----------------------------------------------------------
FROM oven/bun:1.3.14 AS build
WORKDIR /repo

# Workspace manifests first so the install layer caches across source changes.
COPY package.json bun.lock bunfig.toml ./
COPY apps/server/package.json apps/server/
COPY apps/ui/package.json apps/ui/
COPY apps/local/package.json apps/local/
COPY packages/eslint-config/package.json packages/eslint-config/
COPY packages/local-contracts/package.json packages/local-contracts/
COPY packages/mcp-contracts/package.json packages/mcp-contracts/
COPY packages/shared-contracts/package.json packages/shared-contracts/
COPY packages/typescript-config/package.json packages/typescript-config/
COPY packages/ui-contracts/package.json packages/ui-contracts/
COPY plugins/claude-code/package.json plugins/claude-code/
RUN bun install --frozen-lockfile

COPY . .
RUN bun run --filter=server --filter=ui build

# lbug is a native module (dlopen'd .node binding), so the server bundle marks
# it external. Stage a minimal runtime copy — the installed package is ~500 MB
# of which only the JS wrapper + binding (~17 MB) is needed at runtime.
RUN mkdir -p /runtime/node_modules/lbug \
  && cp -L /repo/apps/server/node_modules/lbug/*.js \
    /repo/apps/server/node_modules/lbug/*.mjs \
    /repo/apps/server/node_modules/lbug/package.json \
    /repo/apps/server/node_modules/lbug/lbugjs.node \
    /runtime/node_modules/lbug/

# --- runtime stage --------------------------------------------------------
FROM oven/bun:1.3.14-slim
WORKDIR /app

COPY --from=build /repo/apps/server/dist ./server
COPY --from=build /repo/apps/ui/dist ./ui
# require("lbug") from server/main.js resolves up to /app/node_modules.
COPY --from=build /runtime/node_modules ./node_modules

ENV NODE_ENV=production
ENV UI_DIST_PATH=/app/ui

# Writable home for the on-disk LadybugDB (the default `.data` would land in
# root-owned /app). Mount a Railway volume here for persistence across deploys.
RUN mkdir -p /data && chown bun:bun /data
ENV NOESIS_DATA_DIR=/data

USER bun
EXPOSE 3000
CMD ["bun", "server/main.js"]
