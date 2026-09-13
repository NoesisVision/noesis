# Logging

Both processes log through [LogTape](https://logtape.org/) (decision 75).
The service configures it in `server/backend/src/logging/logging.ts`, the
browser app in `server/frontend/src/logging.ts`; every other module only
asks for a logger. The LogTape skill under `.agents/skills/logtape/` covers
the library; this page is the project's conventions.

## Categories

One root, then the process, then the module:

| Category                 | Who                                                                                                                         |
| ------------------------ | --------------------------------------------------------------------------------------------------------------------------- |
| `noesis.server`          | the service's composition root                                                                                              |
| `noesis.server.<module>` | one backend module: `files`, `http`, `indexer`, `mcp`, `session`, `watcher`, `db`, `schema`, `scanner`, `native`, `browser` |
| `noesis.ui`              | the browser app                                                                                                             |
| `noesis.ui.<module>`     | one frontend module: `api`, `window`, `shell`, …                                                                            |

Get a logger through the helper of the package, never by spelling the array:
`serverLogger('files')` in the backend, `uiLogger('api')` in the frontend.
The second segment says which process wrote a line when both end up in one
place. A library-shaped package (`packages/*`) may log under
`noesis.<package>` and must never call `configure()`.

## Messages

Structured, with named placeholders and a properties object:

```ts
log.info('indexed {files} files in {durationMs} ms', { files, durationMs });
log.warn('skipping {path}: {error}', { path, error: String(error) });
log.error(error, { operation: 'rebuild' }); // an Error carries its stack
```

No string interpolation into the message: the placeholders keep the values
searchable in the JSON file. Levels: `debug` for a developer, `info` for an
operational event (boot, index, request), `warning` for a recoverable
surprise, `error` for a failed operation, `fatal` before exiting.

## Sinks

The service writes every line to two places, always:

- **stderr** — coloured text from source, JSON lines in the built bin
  (`NODE_ENV=production`). stdout is the MCP transport and is never logged
  to. Claude Code keeps the service's stderr under
  `~/Library/Caches/claude-cli-nodejs/<project>/mcp-logs-plugin-noesis-noesis/`.
- **`.noesis/logs/noesis.log`** in the served repository — JSON lines,
  written through, rotated at 5 MB with five files kept. `logs/` is in the
  `.gitignore` the service maintains. `tail -f .noesis/logs/noesis.log` is
  the way to watch a session.

The browser app writes to the console only, at `debug` from source and
`info` in the built bin.

`NOESIS_LOG_LEVEL` (`trace`, `debug`, `info`, `warning`, `error`, `fatal`)
sets the lowest level of both service sinks; the default is `info`.

## Correlation

Every HTTP request gets a request id: the `x-request-id` header when the
caller sends one, a fresh UUID otherwise. The `@logtape/hono` middleware
opens a context for the request, so every line logged while handling it
carries `requestId`, and the response echoes the id. The browser app mints
the id in its fetch wrapper and logs the call under it, so one id joins the
browser's line to the service's lines for the same call.

MCP tool calls get the same treatment: the dispatcher runs each handler in
a context with a fresh `requestId` and the `tool` name.

The readable stderr line shows the id as `(req …)`; the JSON lines carry it
in `properties.requestId`.

## In tests

Nothing is configured, so loggers are silent. A spec that needs the sinks
calls `configureLogging()` against a temporary directory and `reset()` in
its teardown (`test/unit/logging.spec.ts`).
