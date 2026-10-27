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
