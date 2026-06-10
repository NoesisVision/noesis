# Builds the single production image: the NestJS server (bundled, self-contained)
# serving the built ui app (decision 17). Built by Railway via `railway up`.
# Bun version must match `packageManager` in package.json (and CI).

# --- build stage ----------------------------------------------------------
FROM oven/bun:1.3.14 AS build
WORKDIR /repo

# Workspace manifests first so the install layer caches across source changes.
COPY package.json bun.lock bunfig.toml turbo.json ./
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
RUN bunx turbo build --filter=server --filter=ui

# --- runtime stage --------------------------------------------------------
FROM oven/bun:1.3.14-slim
WORKDIR /app

COPY --from=build /repo/apps/server/dist ./server
COPY --from=build /repo/apps/ui/dist ./ui

ENV NODE_ENV=production
ENV UI_DIST_PATH=/app/ui

USER bun
EXPOSE 3000
CMD ["bun", "server/main.js"]
