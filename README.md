# Noesis

Noesis is a Claude Code plugin for visual spec-driven development. It turns
your documents and design drafts into a knowledge graph kept as JSON files in
`.noesis/` inside your repository, shows it in a browser UI, and drives design
and implementation work from it. Everything runs on your machine.

## Install

You need [Claude Code](https://code.claude.com) and [bun](https://bun.com) on
your `PATH`. The Noesis service ships inside the plugin and runs on bun, so
nothing else is downloaded when a session starts.

In Claude Code:

```
/plugin marketplace add https://raw.githubusercontent.com/NoesisVision/noesis/main/plugins/claude-code/.claude-plugin/marketplace.json
/plugin install noesis-beta@noesis
```

Restart Claude Code, or run `/reload-plugins`, and check that `/mcp` lists
`noesis` as connected. Each session then starts its own Noesis service and
opens the UI in your browser; set `NOESIS_OPEN_BROWSER=0` to keep it closed.

`noesis-beta` is the prerelease channel and the only one with a release so
far. The stable channel, `noesis`, installs once its first release is out.

To update:

```
/plugin marketplace update noesis
/plugin update noesis-beta@noesis
```

More on channels, sharing the plugin with a team through the project's
`.claude/settings.json`, and what the plugin ships:
[`plugins/claude-code/README.md`](plugins/claude-code/README.md).

## Scanning your code

Designs start from a _system model_ of the code: its modules, building
blocks and behaviors, which the `scan_system_model` tool builds by running
a parser over the repository. A repository is set up for scanning once, by
a `parser` entry in its `.noesis/settings.json`. When a session starts in a
repository without one, Noesis notices the build at the root and offers the
setup skill for it; you can also ask Claude to set up Noesis scanning. The
skill asks before it edits a build file and ends with a scan.

### Java (Maven or Gradle)

The `setup-java-scanner` skill adds to the build:

- the Noesis parser plugin: `vision.noesis:noesis-parser-maven-plugin`, or
  the Gradle plugin `vision.noesis.parser`;
- the `vision.noesis:noesis-annotations` dependency your domain code is
  annotated with (`@AggregateRoot`, `@ValueObject`, …);
- the `parser` of `.noesis/settings.json`, the command line that runs the
  build's `noesis:parse` goal or `noesisParse` task.

The plugin and the annotations come from Maven Central, at the newest
release, which the skill looks up. A Gradle build needs `mavenCentral()` among its plugin repositories,
since the Gradle plugin is not on the Gradle Plugin Portal. Maven or the
Gradle daemon must run on a JDK 17 or newer, not a JRE. A build that runs
Lombok or other annotation processors gets the `hybrid` engine.

The parser and the plugin agree on one code model schema version. If a scan
says the parser wrote a schema the plugin does not read, the same skill
updates the parser, or tells you to update the plugin. The
[Java parser's README](code-parsers/java/README.md) has the compatibility
table and the plugin's settings.

### .NET (C#)

The `setup-dotnet-scanner` skill:

- installs `noesis-parse-csharp`, a .NET global tool the service runs from
  the `PATH`. It is not on nuget.org yet, so the skill packs it from a
  checkout of this repository (`code-parsers/dotnet`) and installs it from
  there. It needs a .NET 10 SDK; your projects may target older frameworks.
- adds the `NoesisVision.Annotations` package from nuget.org to the projects
  that hold domain code (`[DddAggregate]`, `[DddValueObject]`, …);
- writes `{ "language": "csharp" }` as the `parser` of `.noesis/settings.json`.

`~/.dotnet/tools` must be on the `PATH` Claude Code starts with; restart
Claude Code after installing the tool. The
[.NET parser's README](code-parsers/dotnet/README.md) has the details.

## Developing

The repository is a bun workspaces monorepo: the service in `server/backend`,
the browser UI in `server/frontend` and the Claude Code plugin in
`plugins/claude-code`. [`AGENT.md`](AGENT.md) has the commands, the layout and
the conventions; [`docs/arch/ARCHITECTURE.md`](docs/arch/ARCHITECTURE.md) the
architecture.

```
bun install
bun run dev    # the service and the UI with hot reload
bun run ci     # what CI and the pre-push hook run
```
