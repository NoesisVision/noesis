# Noesis Claude Code plugin

Plugin for visual spec-driven development.

## Requirements

- [bun](https://bun.com) on your `PATH` — the Noesis service is launched with
  `bunx` (fetched from npm on first run, cached afterwards).

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

## How it runs

Every Claude Code session starts its own Noesis service process over stdio.
The service serves the project Claude Code runs in (`NOESIS_ROOT` is set to
the project directory by `.mcp.json`), keeps the knowledge graph in
`.noesis/` at its root, and opens the browser UI once at start. Set
`NOESIS_OPEN_BROWSER=0` in the environment to keep it closed.

Tools never take content inline. The agent writes a working file to the
session's scratch directory (`.noesis/tmp/<session>/`, named in the server's
instructions), runs the `validate` tool against it until clean, and calls the
tool that consumes it by path.

## What's inside

- `contracts/` — the contract sources every knowledge graph file and import
  payload must satisfy, as zod `.ts` the model reads directly, with a
  companion `.md` per family for what the shapes cannot say. Copied from
  `packages/shared-contracts/src` by `bun run generate`, stamped with the
  service version, and asserted byte-identical by the plugin's tests.
- `skills/` — the knowledge-management skills (`import-conversation`,
  `import-document`, `create-design-doc`, `update-design-doc`,
  `search-knowledge-graph`) and the implementation skill
  (`implement-design-doc`). Each names the contract it needs by a path under
  `contracts/`, writes its working file to the session's scratch directory,
  validates it with the `validate` tool until clean, and hands the path to
  the tool that consumes it. Skills preserve locked and human-authored fields
  and ask before changing one.
- `.mcp.json` — launches the Noesis service as a stdio MCP server via
  `bunx @noesis-vision/noesis@<version>` (same repo, released in lockstep
  with the plugin)

## Releasing (maintainers)

Beta releases are fully scripted (from `plugins/claude-code`):

```
bun run release:beta                # next beta counter (0.1.0-beta.2 -> 0.1.0-beta.3)
bun run release:beta 0.2.0-beta.1   # explicit target prerelease
```

The script verifies a clean, up-to-date `main`, bumps the plugin +
`@noesis-vision/noesis` `package.json`s and the beta marketplace pin (one
version train — decisions 33 and 68), regenerates stamped artifacts (including
the `.mcp.json` service pin and the `contracts/` copy), smoke-tests the packed
tarball, then commits, tags, and pushes. The `v*` tag triggers the `Release`
workflow, which publishes both packages to npm via trusted publishing (service
first; prereleases go to the `beta` dist-tag, stable releases to `latest`).

Stable releases follow the same steps by hand — versions are single-sourced
from the plugin's `package.json`:

```
bun run bump 0.2.0   # plugin + service package.json + matching marketplace channel pin
bun run generate     # stamps .claude-plugin/plugin.json + .mcp.json pin, recopies contracts/
git commit -am "Release 0.2.0"
git tag -a v0.2.0 -m "Release 0.2.0" && git push origin main v0.2.0
```
