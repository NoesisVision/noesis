# Noesis Claude Code plugin

Plugin for visual spec-driven development.

## Requirements

- [bun](https://bun.com) on your `PATH` — the MCP bridge is launched with
  `bunx` (fetched from npm on first run, cached afterwards) and the payload
  validator with `bun`.

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

The MCP bridge targets `http://localhost:3000` by default. Override with the
`NOESIS_SERVER_URL` environment variable — e.g. per project in
`.claude/settings.local.json`:

```json
{ "env": { "NOESIS_SERVER_URL": "https://staging.noesis.dev" } }
```

## What's inside

- `skills/prepare-mcp-data` — JSON Schema + canonical example for every MCP
  payload contract, and a zod-backed validator (`scripts/validate.ts`)
- `.mcp.json` — launches the stdio MCP bridge via
  `bunx @noesis-vision/mcp-bridge@<version>` (same repo, released in lockstep
  with the plugin)
- `contracts/` — readable copies of the zod contract sources

## Releasing (maintainers)

Beta releases are fully scripted (from `plugins/claude-code`):

```
bun run release:beta                # next beta counter (0.1.0-beta.2 -> 0.1.0-beta.3)
bun run release:beta 0.2.0-beta.1   # explicit target prerelease
```

The script verifies a clean, up-to-date `main`, bumps the plugin +
`@noesis-vision/mcp-bridge` `package.json`s and the beta marketplace pin (one
version train — decision 33), regenerates stamped artifacts (including the
`.mcp.json` bridge pin), smoke-tests the packed tarball, then commits, tags,
and pushes. The `v*` tag triggers the `Release` workflow, which publishes both
packages to npm via trusted publishing (bridge first; prereleases go to the
`beta` dist-tag, stable releases to `latest`).

Stable releases follow the same steps by hand — versions are single-sourced
from the plugin's `package.json`:

```
bun run bump 0.2.0   # plugin + bridge package.json + matching marketplace channel pin
bun run generate     # stamps .claude-plugin/plugin.json + .mcp.json pin, regenerates references
git commit -am "Release 0.2.0"
git tag -a v0.2.0 -m "Release 0.2.0" && git push origin main v0.2.0
```
