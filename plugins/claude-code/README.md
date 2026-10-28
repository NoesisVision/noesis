# Noesis Claude Code plugin

Plugin for visual spec-driven development.

## Requirements

- [bun](https://bun.com) on your `PATH` — the Noesis service ships inside
  the plugin and runs on bun. Nothing is fetched when a session starts.

## Install

In Claude Code, add the marketplace (it fetches a single JSON file, no clone)
and install the plugin:

```
/plugin marketplace add https://raw.githubusercontent.com/NoesisVision/noesis/main/plugins/claude-code/.claude-plugin/marketplace.json
/plugin install noesis-beta@noesis
```

Then restart Claude Code, or run `/reload-plugins`, and check that `/mcp`
lists `noesis` as connected.

Channels, one entry each in the marketplace:

- `noesis-beta` — prerelease builds (pinned semver, advanced on each
  prerelease). The only channel with a release so far.
- `noesis` — stable releases (pinned semver, advanced on each stable
  release). Its pin, `0.1.0`, is not published yet, so installing it fails
  until the first stable release.

To update, refresh the marketplace and update the plugin:

```
/plugin marketplace update noesis
/plugin update noesis-beta@noesis
```

To share it with a team, add the marketplace to the project's
`.claude/settings.json`, so everyone who opens the project is offered it:

```json
{
  "extraKnownMarketplaces": {
    "noesis": {
      "source": {
        "source": "url",
        "url": "https://raw.githubusercontent.com/NoesisVision/noesis/main/plugins/claude-code/.claude-plugin/marketplace.json"
      }
    }
  },
  "enabledPlugins": { "noesis-beta@noesis": true }
}
```

## How it runs

Every Claude Code session starts its own Noesis service process over stdio. The service serves the project Claude Code runs in
(`NOESIS_ROOT` is set to the project directory by `.mcp.json`), keeps the
knowledge graph as JSON files in `.noesis/` at its root, and opens the
browser UI once at start on an ephemeral port. Set `NOESIS_OPEN_BROWSER=0`
in the environment to keep it closed. The UI lives as long as the session:
when Claude Code exits, the service exits with it.

The service exposes fourteen MCP tools: `create_change`, `update_change`,
`delete_change`, `list_changes`, `create_document_in_change`, `update_document_in_change`,
`list_documents_in_change`, `get_document_in_change`,
`create_design_doc_in_change`, `update_design_doc_in_change`,
`list_design_docs_in_change`, `get_design_doc_in_change`,
`scan_system_model` and `get_newest_system_model`. Tools never
take content inline: `get_design_doc_in_change`, asked for a working file,
writes the design document into the scratch directory and answers with its
path. The agent writes
a working file to the session's scratch directory (`.noesis/sessions/<session>/`,
named in the server's instructions) and calls the tool that consumes it by
path. That tool checks the file against its contract before writing
anything: a file that does not fit comes back as an issue list — path
and message — to correct and call again. No working file carries an id: a
create tool mints it from the creation date and the title and answers with
it, and an update tool takes it as an argument and refuses one that names
nothing.

## What's inside

- `contracts/` — the contracts every knowledge graph file must satisfy, as
  JSON Schema the model reads directly, with an example beside the larger
  ones. A build output: the service generates it from its zod schemas
  (`bun run contracts <dir>` in `server/backend`), and `bun run build` here
  (which `bun pm pack` runs as `prepack`) empties the directory and calls
  that. Only the schemas ship, not the domain objects they sit next to. Only
  `contracts/README.md` is committed; the published plugin carries the
  generated files.
- `skills/` — the skills that drive the tools, one folder per skill.
  `add-change` opens or updates a change through `create_change` or
  `update_change`; `add-document-to-change` takes a Markdown file, asks which
  change from `list_changes` it belongs to and adds it through
  `create_document_in_change`, building the working file with its
  `scripts/write-working-file.ts` so the text is copied, not retyped;
  `create-design-doc` reads a change's documents and the newest system
  model, designs the change as a diff against that model, with the
  modelling guidance in its `references/`, and stores it through
  `create_design_doc_in_change` — or, asked for several alternatives, hands
  each option to a subagent of its own with the brief in its `references/`
  and compares what they saved; `implement-java-spring` turns a design
  document into Java domain code for a Spring Boot project, each module,
  building block and behavior carrying the stereotype the Java parser
  reads, with one JUnit test asserted with AssertJ per scenario, following
  the mapping, building block and testing rules in its `references/`. A skill
  and compares what they saved; `update-design-doc` fetches a design
  document as stored now through `get_design_doc_in_change` into a working
  file, lists the fields a person accepted with its `scripts/human-fields.ts`,
  asks before changing any of them, edits it as the user asks and stores it
  in place through `update_design_doc_in_change`, which keeps an accepted
  field the agent left alone in the person's name; `setup-java-scanner`
  adds the Noesis parser plugin and the `noesis-annotations` dependency, both
  from Maven Central, to a Maven or Gradle build and writes the `parser` of `.noesis/settings.json`
  that runs it; `setup-dotnet-scanner` installs the `noesis-parse-csharp`
  tool, adds the `NoesisVision.Annotations` package to the domain projects
  and writes `{ "language": "csharp" }` there. Both prove the setup with
  `scan_system_model`. A skill
  names the contract it needs by a path under `contracts/`. Where the tool
  takes a file, the
  skill writes its working file to the session's scratch directory and hands
  the path to the tool that consumes it, correcting the file from the issue
  list the tool returns.
- `hooks/` — a `SessionStart` hook, `check-scanner-settings.ts`, run by
  bun. When the project's `.noesis/settings.json` is missing, is not JSON
  or names no `parser`, it tells the agent that scans will fail and to
  offer the setup skill for the build it finds at the root (Maven or Gradle,
  a solution or project), and shows the user a one-line notice. A
  configured project gets no output.
- `server/` — the built Noesis service: `main.js` and the page in `ui/`,
  copied from `server/backend/dist/` by `bun run build` and gitignored.
- `.mcp.json` — launches the bundled service as a stdio MCP server via
  `bun ${NOESIS_SERVICE_ENTRY:-${CLAUDE_PLUGIN_ROOT}/server/main.js}`. Set
  `NOESIS_SERVICE_ENTRY` to run another entry, such as the checkout's source;
  unset, the bundle runs.
- `.claude-plugin/plugin.json` — the plugin manifest, its version stamped by
  `bun run generate`; `marketplace.json` beside it is the catalog users add
  by URL, with one entry per channel pinned to a published npm version.
- `tools/` — `build-contracts.ts`, `build-service.ts`, `stamp-plugin-version.ts`,
  `bump-version.ts` and `release-beta.ts`; behind the scripts below and not
  shipped.
- `test/` — asserts a build leaves only fresh contracts, that every
  contract a skill names is among them, that a packed tarball carries exactly the shipped files, skills and service included,
  that the service in it boots, lists its tools and serves the page,
  and that the skill scripts do what their skills say: the working-file
  script copies its source verbatim, the human-fields script names every
  field a person wrote or accepted, and the session start hook speaks only
  when scanning is not configured, naming the setup skill for the build.

Only `.claude-plugin/plugin.json`, `.mcp.json`, `contracts/`, `hooks/`, `skills/` and `server/` are published
(the `files` field in `package.json`).

## Scripts

| Script                 | What it does                                                        |
| ---------------------- | ------------------------------------------------------------------- |
| `bun run build`        | Generate `contracts/`, build the service into `server/` (`prepack`) |
| `bun run generate`     | Stamp the version into `plugin.json`                                |
| `bun test`             | Contracts build, tarball contents, the shipped service boots        |
| `bun run check-types`  | `tsc --noEmit`                                                      |
| `bun run bump <v>`     | Bump plugin + service versions and the matching marketplace pin     |
| `bun run release:beta` | Bump, generate, smoke-test the tarball, commit, tag, push           |
| `bun run publish:beta` | Local fallback: `bun publish --tag beta` (never raw `npm publish`)  |

## Developing against the checkout

Load the plugin from the source folder into a session in another repository
(the sample app you exercise it on), with the service running from the
checkout's source instead of the bundled `server/main.js`.

Once in the checkout, and again after every contract change, generate the
contracts into the plugin:

```
bun run build:plugin
```

Then, in the sample app repository:

```
NOESIS_SERVICE_ENTRY=/path/to/noesis/server/backend/src/main.ts \
claude --plugin-dir /path/to/noesis/plugins/claude-code
```

The service runs from `src/main.ts` with no build (the page is bundled on
request) and serves the repository Claude Code started in. The local plugin
takes precedence over an installed `noesis` for that session. After editing
a skill or the service, run `/reload-plugins`. Set the variable in the
sample app's `.claude/settings.local.json` under `env` to skip typing it.

## Releasing (maintainers)

Beta releases are fully scripted (from `plugins/claude-code`):

```
bun run release:beta                # next beta counter (0.1.0-beta.2 -> 0.1.0-beta.3)
bun run release:beta 0.2.0-beta.1   # explicit target prerelease
```

The script verifies a clean, up-to-date `main`, bumps the plugin and
service `package.json`s (the service reports its version over MCP) and the
beta marketplace pin, regenerates stamped artifacts (`plugin.json`),
smoke-tests the packed tarball (whose `prepack` generates `contracts/` and
builds the service into `server/`), then commits, tags, and pushes. The `v*`
tag triggers the `Release` workflow (`.github/workflows/release.yml`), which
re-runs the verify steps, checks the stamped files are committed, verifies
the tag against both versions, packs with `bun pm pack` and publishes the one
package to npm via trusted publishing (prereleases go to the `beta`
dist-tag, stable releases to `latest`). The service is not published on its
own: `server/backend` is private.

Stable releases follow the same steps by hand — versions are single-sourced
from the plugin's `package.json`:

```
bun run bump 0.2.0   # plugin + service package.json + matching marketplace channel pin
bun run generate     # stamps .claude-plugin/plugin.json
git commit -am "Release 0.2.0"
git tag -a v0.2.0 -m "Release 0.2.0" && git push origin main v0.2.0
```
