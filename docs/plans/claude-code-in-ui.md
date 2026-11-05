# Claude Code inside the Noesis page

A proof of concept: the person works with the agent from the Noesis page
instead of a terminal beside it. The page gets an agent panel down its right
side, where a design document is created and revised through the plugin's
own skills, with the person's messages, files, answers and permissions all
given there.

## Two ways the page reaches a session

| The service was started by                                     | Mode       | What the page speaks to                                                                                                                                             |
| -------------------------------------------------------------- | ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| a person (`bun run dev`, the bin by hand: a terminal on stdin) | `embedded` | A Claude Code session the service starts beside the page, through the Claude Agent SDK, from the `claude` installed on this machine, with the Noesis plugin loaded. |
| an agent, over stdio (the plugin's `.mcp.json`)                | `attached` | The session that started the service. Nothing else is started: a message goes out on the MCP connection as a channel event, and the session answers through a tool. |

`main.ts` decides by `process.stdin.isTTY`, as it already did for the page.
`boot/agent.ts` builds the host; `createServices` wires it to the handlers
the `/ui/agent` routes call.

### Embedded: the Agent SDK over the person's own Claude Code

`ClaudeCodeAgentHost` (`adapters/out/agent/`) runs `query()` from
`@anthropic-ai/claude-agent-sdk` in streaming-input mode: the person's
messages are an async queue the session reads from, so one session lasts as
long as the page. What the session says comes back as SDK messages and lands
in an `AgentTranscript` (`app/agent/`), which the page follows as server-sent
events (`GET /ui/agent/events`).

The SDK is pointed at the `claude` on `PATH` (`pathToClaudeCodeExecutable`),
never at the binary the SDK package bundles: the session is the person's own
Claude Code, with their login, settings, plugins and hooks. The service passes
no credentials and sets no `ANTHROPIC_*` variable; it adds only
`NOESIS_OPEN_BROWSER=0` (the page is already open) and, from source,
`NOESIS_SERVICE_ENTRY` so the plugin's `.mcp.json` runs this checkout's
service. Licensing: Anthropic's terms let an end user sign in to the
unmodified Claude Code binary with their own subscription, including where a
platform hosts it; they forbid a third party offering Claude.ai login, routing
requests through a subscription on a user's behalf, or holding their tokens.
This design does none of that. Distributing Noesis with this feature is still
something to confirm against the terms of the day.

The session's own Noesis tools come from the plugin: the plugin's `.mcp.json`
starts a second service process for the session, in `attached` mode, over
stdio. Files are the source of truth, so the page's process and the session's
process read the same graph; the page re-reads what it shows whenever a tool
call of the session ends.

Permissions stay with the person: `permissionMode: 'default'`, and every
prompt comes to the page through `canUseTool` as a permission card (allow
once, allow for this session, refuse). The card shows the whole call, uncut,
and "allow for this session" keeps the rule with the session, never in a
settings file. What asks at all is the person's own Claude Code
configuration: with auto mode on in their settings, the classifier decides
most calls and the page sees only the ones it cannot. A short allow-list spares the person
the read-only calls: `Read`, `Glob`, `Grep`, writes under
`.noesis/sessions/`, and the plugin's `list_*` and `get_*` tools. An
`AskUserQuestion` call is a question card: the options the skill offers, one
more for the person's own words, and one button for all of them.

### Attached: the channel into the session that started the service

`AttachedAgentHost` (`adapters/in/mcp/`) sends a message as a
`notifications/claude/channel` notification on the connection the host
opened, with the MCP server declaring the `claude/channel` experimental
capability and offering a `reply_to_noesis_page` tool for the answer. Claude
Code reads channel events only in an interactive session started with the
channel loaded (`--dangerously-load-development-channels`, a research
preview), so the panel says so; otherwise a message goes nowhere, and the
session answers in its terminal. This half is unverified end to end: a
headless run cannot start an interactive session with that flag.

## The page

- The panel is an `AppShell.Aside` the shell opens from the bar (the sparkles
  button, `⌘.`), remembered between visits. Its state lives in
  `features/agent/agent-panel-context.tsx`, so a view can open it with words
  already in the composer.
- `features/agent/` is the domain: `agent.api.ts` (the session query, kept
  current by the event stream; the mutations), `agent.model.ts` (icon, status
  words, the skill invocations, file rules), `ui/` (panel, entries, composer,
  question and permission cards).
- "Design with the agent" on the design docs view, and "Revise with the agent"
  on a design document, open the panel with `/noesis:create-design-doc <change> 1`
  or `/noesis:update-design-doc <change> <doc> ` written, for the person to
  add to and send.
- A file attached in the composer is uploaded to the session's scratch
  directory (`POST /ui/agent/files`) and named to the agent by its path, which
  is what the plugin's skills take.

## Left out of the proof of concept

- Resuming a session across restarts, several sessions, a session per change.
- Images and other binary attachments as content blocks (they upload and are
  named by path only).
- Verifying the attached mode against an interactive Claude Code with the
  channel flag.
- One service process for both the page and the session's tools.
