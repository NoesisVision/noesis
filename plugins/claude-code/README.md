# Noesis Claude Code plugin

Skills for preparing and validating Noesis MCP tool payloads, plus the
`noesis-local` MCP server that talks to a Noesis server app over REST.

## Requirements

- [bun](https://bun.com) on your `PATH` — the MCP server and the payload
  validator are launched with `bun`.

## Install

Add the marketplace (fetches a single JSON file, no clone), then install:

```
/plugin marketplace add https://raw.githubusercontent.com/NoesisVision/noesis/main/plugins/claude-code/.claude-plugin/marketplace.json
/plugin install noesis
```

Channels:

- `noesis` — stable releases (pinned semver, advanced on each stable release)
- `noesis-beta` — prerelease builds for testers (pinned semver, advanced on
  each prerelease)

## Configuration

The MCP server targets `http://localhost:3000` by default. Override with the
`NOESIS_SERVER_URL` environment variable — e.g. per project in
`.claude/settings.local.json`:

```json
{ "env": { "NOESIS_SERVER_URL": "https://staging.noesis.dev" } }
```

## What's inside

- `skills/prepare-mcp-data` — JSON Schema + canonical example for every MCP
  payload contract, and a zod-backed validator (`scripts/validate.ts`)
- `servers/noesis-local.js` — self-contained stdio MCP server bundle
- `contracts/` — readable copies of the zod contract sources

## Releasing (maintainers)

Versions are single-sourced from `package.json`:

```
bun run bump 0.2.0   # package.json + matching marketplace channel pin
bun run generate     # stamps .claude-plugin/plugin.json, regenerates references
git commit && git tag v0.2.0 && git push --follow-tags
```

The `Release` GitHub Actions workflow publishes the tag to npm via trusted
publishing (prerelease versions go to the `beta` dist-tag, stable to `latest`).
