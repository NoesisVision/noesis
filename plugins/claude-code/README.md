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

Every Claude Code session starts its own Noesis service process over stdio
(decision D1). The service serves the project Claude Code runs in
(`NOESIS_ROOT` is set to the project directory by `.mcp.json`), keeps the
knowledge graph as JSON files in `.noesis/` at its root, and opens the
browser UI once at start on an ephemeral port. Set `NOESIS_OPEN_BROWSER=0`
in the environment to keep it closed. The UI lives as long as the session:
when Claude Code exits, the service exits with it.

The service exposes three MCP tools: `create_change`, `list_changes` and
`add_document_to_change`. Tools never take content inline. The agent writes
a working file to the session's scratch directory (`.noesis/tmp/<session>/`,
named in the server's instructions) and calls the tool that consumes it by
path. That tool checks the file against its contract before writing
anything: a file that does not fit comes back as an issue list — path
and message — to correct and call again.

## What's inside

- `contracts/` — the contract sources every knowledge graph file must
  satisfy, as zod `.ts` the model reads directly. A build output: copied from
  the service's `server/backend/src/app/<feature>/model/` folders, layout
  kept, by `bun run build` (which
  `bun pm pack` runs as `prepack`), stamped with the plugin version, and
  asserted byte-identical by the plugin's tests (decision D4). Only
  `contracts/README.md` is committed; the published plugin carries the full
  copy.
- `skills/` — the skills that drive the tools, one folder per skill.
  `create-change` opens a change through `create_change`;
  `add-document-to-change` takes a Markdown file, asks which change from
  `list_changes` it belongs to and adds it through `add_document_to_change`, building the working file with its
  `scripts/write-working-file.ts` so the text is copied, not retyped. A skill
  names the contract it needs by a path under `contracts/`. Where the tool
  takes a file, the
  skill writes its working file to the session's scratch directory and hands
  the path to the tool that consumes it, correcting the file from the issue
  list the tool returns.
- `.mcp.json` — launches the Noesis service as a stdio MCP server via
  `${NOESIS_SERVICE_COMMAND:-bunx} ${NOESIS_SERVICE_ENTRY:-@noesis-vision/noesis@<version>}`
  (same repo, released in lockstep with the plugin). The two variables
  replace the command and its one argument; unset, the defaults apply
  (decision D6). The pin is stamped by `bun run generate`.
- `.claude-plugin/plugin.json` — the plugin manifest, its version stamped by
  `bun run generate`; `marketplace.json` beside it is the catalog users add
  by URL, with one entry per channel pinned to a published npm version.
- `tools/` — `copy-contracts.ts`, `stamp-plugin-version.ts`,
  `bump-version.ts` and `release-beta.ts`; behind the scripts below and not
  shipped.
- `test/` — asserts the contracts copy is byte-identical to the source and
  that a packed tarball carries exactly the shipped files, skills included,
  and that the working-file script copies its source verbatim.

Only `.claude-plugin/plugin.json`, `.mcp.json`, `contracts/` and `skills/` are published
(the `files` field in `package.json`).

## Scripts

| Script                 | What it does                                                       |
| ---------------------- | ------------------------------------------------------------------ |
| `bun run build`        | Copy the contracts into `contracts/` (also runs as `prepack`)      |
| `bun run generate`     | Stamp the version into `plugin.json` and the `.mcp.json` pin       |
| `bun test`             | Contracts byte-identity + tarball contents                         |
| `bun run check-types`  | `tsc --noEmit`                                                     |
| `bun run bump <v>`     | Bump plugin + service versions and the matching marketplace pin    |
| `bun run release:beta` | Bump, generate, smoke-test the tarball, commit, tag, push          |
| `bun run publish:beta` | Local fallback: `bun publish --tag beta` (never raw `npm publish`) |

## Developing against the checkout

Load the plugin from the source folder into a session in another repository
(the sample app you exercise it on), with the service running from the
checkout's source instead of the published bin.

Once in the checkout, and again after every contract change, copy the
contracts into the plugin:

```
bun run build:plugin
```

Then, in the sample app repository:

```
NOESIS_SERVICE_COMMAND=bun \
NOESIS_SERVICE_ENTRY=/path/to/noesis/server/backend/src/main.ts \
claude --plugin-dir /path/to/noesis/plugins/claude-code
```

The service runs from `src/main.ts` with no build (the page is bundled on
request, decision D5) and serves the repository Claude Code started in. The local plugin
takes precedence over an installed `noesis` for that session. After editing
a skill or the service, run `/reload-plugins`. Set the two variables in the
sample app's `.claude/settings.local.json` under `env` to skip typing them.

## Releasing (maintainers)

Beta releases are fully scripted (from `plugins/claude-code`):

```
bun run release:beta                # next beta counter (0.1.0-beta.2 -> 0.1.0-beta.3)
bun run release:beta 0.2.0-beta.1   # explicit target prerelease
```

The script verifies a clean, up-to-date `main`, bumps the plugin +
`@noesis-vision/noesis` `package.json`s and the beta marketplace pin (one
version train — decision D6), regenerates stamped artifacts (the
`.mcp.json` service pin), smoke-tests the packed tarball (whose `prepack`
copies `contracts/`), then commits, tags, and pushes. The `v*` tag triggers the `Release`
workflow (`.github/workflows/release.yml`), which re-runs the verify steps,
checks the stamped pins are committed, verifies the tag against both package
versions, packs with `bun pm pack` and publishes both packages to npm via
trusted publishing (service first, so the plugin's pin always resolves;
prereleases go to the `beta` dist-tag, stable releases to `latest`).

Stable releases follow the same steps by hand — versions are single-sourced
from the plugin's `package.json`:

```
bun run bump 0.2.0   # plugin + service package.json + matching marketplace channel pin
bun run generate     # stamps .claude-plugin/plugin.json + .mcp.json pin
git commit -am "Release 0.2.0"
git tag -a v0.2.0 -m "Release 0.2.0" && git push origin main v0.2.0
```
