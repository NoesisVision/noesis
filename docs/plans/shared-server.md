# Plan: one service per repository, shared by every session

Today every Claude Code session starts its own service process over stdio
(`plugins/claude-code/.mcp.json`), and that process is the whole thing: the MCP
tools, the graph files, the UI on an ephemeral port and a browser tab of its
own. Three sessions in one repository mean three processes, three ports, three
tabs and three writers on the same graph files. This plan splits the process in
two: a **daemon** per repository that owns the graph and the UI, and a thin
**shim** per session that speaks MCP on stdio and calls the daemon over plain
HTTP. The shim is the MCP server; the daemon never speaks MCP.

## Decisions

| Topic        | Decision                                                                                                                                                                                                                                                                                                                                                                                                           |
| ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Transport    | Plain HTTP between shim and daemon: the Hono `/ui` surface the frontend already uses, through the typed `hc<AppType>` client. No MCP over HTTP, no `StreamableHTTPServerTransport`                                                                                                                                                                                                                                 |
| Who is MCP   | The shim. `serveStdio`, `createMcpServer`, the era probe and every tool module stay where they are, bodies included: the tools already take the `Handler` interfaces from `app/`, and the shim hands them implementations that call the daemon over HTTP                                                                                                                                                           |
| Entrypoints  | One bin, three subcommands: `noesis serve` (the daemon; also what a bare `noesis` and `bun run dev` run), `noesis attach` (the shim, what `.mcp.json` launches) and `noesis stop` (ends the daemon of the current repository)                                                                                                                                                                                      |
| Registration | The daemon registers itself, however it was started. Each boot mints an `instance` (`crypto.randomUUID()`). `.noesis/server.lock` — `{ pid, processStart, instance, startedAt }`, created with `wx` — is taken before binding. `.noesis/server.json` — `{ pid, instance, port, version, startedAt }` — is written once it listens. Shutdown removes each file only while it still names this instance              |
| Ownership    | A lock is held while the process it names runs: its pid answers signal 0 **and** `ps -o lstart= -p <pid>` still equals the `processStart` recorded in the lock, which a pid reused after a reboot or a crash fails. Nothing else revokes it — not a timeout, not a slow `health`                                                                                                                                   |
| Readiness    | `GET /internal/health` answers `{ status, version, instance }`. It is asked by the shim and by `noesis stop`, never by registration: a daemon that owns the lock but does not answer is busy or stuck, not gone. The version is compared by the shim                                                                                                                                                               |
| Session      | Unchanged. `SessionDir` and `SessionFiles` belong to the shim: one scratch directory per session, `owner.json` naming the shim's pid, the working file read and checked in the shim and sent as the request body                                                                                                                                                                                                   |
| Lifetime     | A daemon started by a shim (`serve --managed`) exits once no session has been attached for the grace period, counted from boot as well as from the last detach. One started by hand runs until a signal                                                                                                                                                                                                            |
| Attach       | `GET /internal/attach` is a server-sent event stream the shim keeps open for the session. The daemon counts open streams; the count at zero starts the grace timer, a new stream cancels it                                                                                                                                                                                                                        |
| Grace        | 5 minutes, so `/reload-plugins` and a quick restart of Claude Code find the same daemon and the same port. `NOESIS_GRACE_MS` overrides it, for the e2e specs                                                                                                                                                                                                                                                       |
| Browser      | Opened once, by the daemon, when it starts. A shim attaching to a running daemon opens nothing and logs the URL                                                                                                                                                                                                                                                                                                    |
| Version skew | The shim refuses an alive daemon whose `version` differs from its own: an in-band tool error naming `noesis stop`, never a silent restart while others may be attached. Run from source, the version is the package's, so a daemon holding old code goes unnoticed: `noesis stop` is the restart                                                                                                                   |
| Errors       | One wire contract, `ErrorBody`: a zod union on `error`, encoded by `answerError` and decoded by the shim, carrying everything the domain errors hold (`entity`, `id`, `change`, `violations`). `hc` types no `onError` answer, so the shim parses the body with `ErrorBody` rather than trusting the client's types. The rebuilt domain error is thrown, so `logged` in `tool-handler.ts` answers exactly as today |
| Shutdown     | In order: refuse new requests, close the attach streams, let in-flight requests finish, stop the server, release the registration. `Bun.serve`'s `stop()` waits for open connections, so an attach stream left open would hold it forever                                                                                                                                                                          |
| Writes       | All graph writes go through the daemon, so the optimistic `version` check in the repository now guards one process. Nothing else about persistence changes                                                                                                                                                                                                                                                         |
| Ports        | Still ephemeral by default; `PORT` pins it as today. Two repositories on one machine never collide                                                                                                                                                                                                                                                                                                                 |
| Platform     | macOS and Linux. Detached spawn and signal 0 are not made to work on Windows here                                                                                                                                                                                                                                                                                                                                  |
| Delivery     | Several commits on one branch, in the order below. Every commit leaves `.mcp.json` launching something that speaks MCP                                                                                                                                                                                                                                                                                             |

## The daemon (`noesis serve`)

What `main.ts` is today without the MCP half: `openWorkspace` minus the session
directory, `createServices`, `UiHost`, `installLifecycle`. Plus:

- `ServerRegistration` (`boot/registration.ts`), in two steps:
  - **Before binding**, take `server.lock` with `wx`. When it exists and its
    owner still runs (pid and `processStart`, as under Ownership), the new
    daemon logs `already running at {url}` — or `already starting` while
    `server.json` does not yet name the owner's instance — and exits, with 1
    when started by hand and 0 under `--managed`. It asks nothing of `health`: a
    stuck owner still owns. A lock naming this process — same pid, same
    `processStart` — is ours, which covers `bun --watch` restarting in place.
  - A lock whose owner is gone is reclaimed under a guard, so two daemons
    judging the same lock stale cannot both end up holding it: take
    `server.lock.reclaim` with `wx`, read `server.lock` again, and only if it is
    still the stale lock that was judged, remove it and take it with `wx`; then
    remove the guard. A daemon that loses the guard waits 100 ms and starts over
    from reading the lock. A guard whose owner is gone is removed and the
    attempt starts over; it is held for milliseconds, so only a crash in the
    middle of a reclaim leaves one.
  - **After `Bun.serve` reports its port**, write `server.json` atomically
    (temporary file plus rename). A stale `server.json` is overwritten, since
    holding the lock proves nobody is alive behind it.
  - `release` removes `server.json` and then `server.lock`, each only while it
    still names this instance.
- `GET /internal/health` answers `{ status: 'ok', version, instance }`.
- `POST /internal/shutdown` with `{ instance }` answers 202 and starts
  `lifecycle.shutdown()` when the instance is this daemon's, and 409 otherwise.
  This is how `noesis stop` ends a daemon: no signal to a recorded pid, which
  may by now be another process. `/internal` already refuses a `Host` other than
  this machine.
- `GET /internal/attach` streams `event: attached` with `{ url, instance }` once
  (Hono `streamSSE`), then a comment line every 5 seconds. Bun closes a
  connection idle for `idleTimeout` (10 seconds by default), so the route also
  calls `server.timeout(c.req.raw, 0)` for its request; the heartbeat is the
  second guard. `stream.onAbort` decrements the count, so a shim killed with
  `SIGKILL` detaches too.
- `AttachCounter` holds the open streams, not only their number. Under
  `--managed` it arms the grace timer at boot and whenever the count reaches
  zero, cancels it on a new stream, and calls `lifecycle.shutdown()` when it
  fires. The shutdown reason is logged. `closeAll()` ends every stream it holds.
- Shutdown, in `release`, in this order:
  1. A `draining` flag set first makes every `/ui` and `/internal` route answer
     503 `shutting_down`, so no new write starts and no new stream attaches.
  2. `AttachCounter.closeAll()` ends the attach streams; the shims see the
     stream end and reconnect on their next call.
  3. `UiHost.stop()` calls `server.stop()`, which now resolves once the
     in-flight requests are answered. After 5 seconds it calls
     `server.stop(true)`, closing whatever is left, and logs that it did.
  4. The registration is released.
- Under `--managed` the daemon has no terminal: stdin is `/dev/null`, stdout
  too, and stderr goes to `.noesis/logs/noesis-serve-boot.log` (appended), so a
  failure before logging is configured — `configuredOrExit` in `workspace.ts` —
  still leaves a trace. After that the log file is the record, so the
  `listening on {url}` line and the shutdown reason must be in it.
- Logs stay one file per process: `noesis-serve-<pid>.log` for a daemon,
  `noesis-<session>.log` for a shim as today. `configureLogging` takes the
  file's name part (`fileId`) instead of `sessionId`. `removeStaleLogs` skips a
  `noesis-serve-<pid>.log` whose pid still runs, so a quiet daemon of more than
  7 days does not lose its file to a shim's sweep.

The write routes the tools need, on `/ui` beside the existing reads (the
frontend gains them for free, should it ever author from the page):

| Tool                               | Route                                          |
| ---------------------------------- | ---------------------------------------------- |
| `create_change`                    | `POST /ui/changes` (exists)                    |
| `update_change`                    | `PATCH /ui/changes/:id`                        |
| `list_changes`                     | `GET /ui/changes` (exists)                     |
| `add_source_document_to_change`    | `POST /ui/changes/:change/source-documents`    |
| `update_source_document_in_change` | `PUT /ui/changes/:change/source-documents/:id` |
| `add_design_doc_to_change`         | `POST /ui/changes/:change/design-docs`         |
| `update_design_doc_in_change`      | `PUT /ui/changes/:change/design-docs/:id`      |

Bodies are validated with `jsonBody(<schema>)` against the same app schemas the
tools read working files with (`CreateChange`, `UpdateChange`, the design-doc
and source-document file schemas). Nested routes pass every param to one
`routeParams` call, `:change` included. The write routes sit behind Hono's
`bodyLimit` at `MAX_WORKING_FILE_BYTES`: `/ui` answers every local caller, not
only the shim. The constant moves out of `adapters/in/mcp/session-files.ts` into
`platform/` so both sides import it.

The error answers become one contract, `ErrorBody`, in
`adapters/in/ui/error-body.ts` beside `answerError`: a zod union discriminated
on `error`, the one place that encodes a domain error into a status and a body
and decodes it back. The shim imports it from `boot/`, which may import every
layer. The codes the page already has a sentence for are kept:

| Status | `error`                         | Also carries                            | Rebuilt as                    |
| ------ | ------------------------------- | --------------------------------------- | ----------------------------- |
| 400    | `invalid_body`                  |                                         | unforeseen                    |
| 404    | `change_not_found`, `not_found` | `entity`, `id`, `change` when it is set | `NotFoundError`               |
| 409    | `conflict`                      | `change`                                | `ConcurrentModificationError` |
| 413    | `payload_too_large`             | `limit`                                 | unforeseen                    |
| 422    | `invalid_design_doc`            | `violations` (`path`, `reason`)         | `InvalidDesignDocError`       |
| 503    | `shutting_down`                 |                                         | `DaemonUnavailableError`      |
| 500    | `internal`                      |                                         | unforeseen                    |

`bodyLimit` answers through `ErrorBody` too, from its `onError`. A body that
does not parse as `ErrorBody` is itself unforeseen, quoting the status. The
route specs assert every row round-trips: the error thrown in a handler equals,
field by field and message included, the error the decoder rebuilds.

The comment on `NoesisChangesRepository` ("enough for the one process that
serves a session") is updated to say the daemon is that one process.

## The shim (`noesis attach`)

`main.ts` keeps its shape — `openWorkspace`, `serveMcp`, `installLifecycle` —
and swaps `createServices` for a `DaemonClient` and the handlers built on it.
`serveMcp` takes the seven handlers `McpServerDeps` already names instead of
`Services`.

- `DaemonClient` (`boot/daemon-client.ts`) holds one promise of a connection.
  `connection()` returns it, starting a connect when there is none, so
  concurrent calls share one start and one reconnect. A connect that fails
  clears the promise, so the next call tries again, and rejects with a
  `DaemonUnavailableError` naming why.
- `onServing` calls `void client.connection().catch(logFailure)`, so the era
  probe still costs nothing and starts no daemon, the first session warms the
  connection early, and a failed start is logged rather than left as an
  unhandled rejection — which `installLifecycle` would answer by ending the
  shim. The first tool call awaits the same promise; nothing depends on
  `onServing` having finished.
- A connect reads `server.json`. When its lock owner runs (as under Ownership),
  the shim asks `health` for up to 10 seconds and requires the `instance` to
  match `server.json`. Answering with another version: the connect fails with
  the version-skew reason. Answering with the same version: it opens the attach
  stream and builds the `hc` client for `http://127.0.0.1:<port>/ui`. Owner
  running but not answering: the connect fails with a reason naming the pid and
  `noesis stop`; the shim never starts a second daemon beside a live owner.
- Nobody owns the lock: it spawns
  `[process.execPath, process.argv[1], 'serve', '--managed']` through
  `node:child_process` `spawn` with `detached: true`, the same `NOESIS_*`
  environment, `cwd` set to the repository root, stdio as described for the
  daemon, then `unref()`s it (`Bun.spawn` has no detached mode). It polls
  `server.json` plus `health` for up to 10 seconds. The shim takes no lock: two
  shims racing both spawn, the daemon that loses the lock exits, and both shims
  find the winner in `server.json`.
- Connected, it logs `attached to {url}` on stderr and in its log; the e2e
  harness reads this line instead of `listening on`.
- The attach stream ending, or a 503 `shutting_down`, clears the promise. The
  next tool call reconnects first — starting a daemon if it must — and is then
  sent: it never left, so nothing needs repeating. A call whose request fails in
  flight (connection reset, no response) throws an `OutcomeUnknownError`:
  `create_change` and the `add_*` tools are not idempotent, and a retry after a
  write that landed would duplicate it. The session's scratch directory survives
  either way, since the shim owns it.
- The handlers (`boot/daemon-handlers.ts`) implement the `Handler` interfaces
  from `app/` on `hc<AppType>`: await `client.connection()`, send the input,
  then parse the answer with the app schema the handler's type already names —
  `ChangeSummary`, `ChangeWithEntries`, `DesignDocSummary`,
  `SourceDocumentSummary`. That restores the value object brands the JSON
  dropped and catches skew the version check missed; the tools' output schemas
  stay the MCP surface's concern. An error answer is decoded with `ErrorBody`
  and the rebuilt error thrown. They live in `boot/` because that is the one
  layer allowed to import `AppType` (`boot/app.types.ts`) as well as
  `adapters/in/ui/error-body.ts`.
- `DaemonUnavailableError` and `OutcomeUnknownError` live in
  `adapters/in/mcp/daemon-errors.ts`, and `foreseen()` in `tool-handler.ts`
  answers them in-band: the first with its reason and, for version skew,
  `noesis stop`; the second saying the outcome is unknown and to read the change
  with `list_changes` before repeating the call. Neither falls to the "not a
  foreseen failure" answer, whose advice would be wrong here.
- Every tool module, `SessionFiles`, `workingFilePath` and every tool
  description are untouched: the tools call `handle()` as today.
- The shim never imports the daemon's handler implementations, the repositories,
  `createServices` or `UiHost`. It shares the `app/` model schemas, handler
  types and error classes, and the `ErrorBody` contract.

`noesis stop` reads `server.json`, asks `health`, and when the `instance`
matches, sends `POST /internal/shutdown` with it and waits up to 10 seconds for
`server.json` to go. A daemon that does not answer is left alone and reported
with its pid; `noesis stop --force` then sends `SIGTERM`, but only after
checking the pid still names the lock's process (pid plus `processStart`). A
`server.json` with no running owner is stale: `stop` says so and removes nothing
it did not verify. Attached shims reconnect on their next call and start a fresh
daemon. For a developer running from the checkout whose daemon holds old code,
this is the restart.

## Plugin and docs

- `.mcp.json` args become `["${NOESIS_SERVICE_ENTRY:-…}", "attach"]`;
  `bun run generate` keeps stamping the pin. Both `bunx <pkg> attach` and
  `bun src/main.ts attach` resolve the same way.
- `plugins/claude-code/README.md` ("How it runs"), `AGENT.md` (the
  one-process-per-session paragraph, the `ui/` write surface sentence, the log
  file naming) and `docs/arch/ARCHITECTURE.md` describe the split.
- `server/backend/package.json` description and `dev` script: `dev` runs
  `bun --watch src/main.ts serve` by hand, as it does today with a terminal.

## Tests

- Route specs for the five new writes, the body limit, and every `ErrorBody` row
  round-tripping from the error a handler throws to the error the decoder
  rebuilds, `NotFoundError.change` and its message included.
- Unit:
  - `ServerRegistration`: a lock whose pid is dead is retaken; a lock whose pid
    now names another process (different `processStart`) is retaken; a lock
    whose owner runs makes the second daemon exit, **also when that owner does
    not answer `health`**; a lock naming this process is ours; two daemons
    reclaiming one stale lock at once end with exactly one holder; a guard left
    by a dead owner is removed; `release` leaves alone a `server.json` or
    `server.lock` naming another instance.
  - `AttachCounter`: shutdown after the grace from boot with nobody attached,
    grace cancelled by a late attach, shutdown after the last detach, an aborted
    stream counted as a detach, `closeAll()` ending every stream.
  - Shutdown: with two attach streams open, `release` resolves, the streams see
    their end, a write in flight is answered before the server stops, and a
    request arriving after the start answers 503 `shutting_down`.
  - `/internal/shutdown`: another instance answers 409 and nothing stops.
  - `DaemonClient` against a fake daemon: version mismatch; an `instance` that
    does not match `server.json`; dead pid with a fresh file; an owner running
    but not answering, where no second daemon is spawned; five concurrent first
    calls sharing one connect and one spawn; a connect that fails, answered
    in-band, with the shim still running, and the next call trying again;
    reconnect before a call after the stream closed; a request failing in flight
    answered as an unknown outcome.
  - `noesis stop`: a matching instance shuts down over HTTP; a `server.json`
    whose pid names an unrelated process is reported, and that process gets no
    signal, with or without `--force`.
- e2e (`service-process.ts`): start two shims on one throwaway `NOESIS_ROOT`,
  assert one `server.json`, one port in both `attached to` lines, a change
  created through the first listed through the second; hold both past 10 seconds
  and assert the daemon still counts two sessions; kill one shim and assert the
  daemon stays; kill both and, with `NOESIS_GRACE_MS` set low for the run,
  assert it exits and `server.json` is gone. Then stop a daemon with a shim
  attached through `noesis stop` and assert it exits within the 10 seconds.
  `afterAll` runs `noesis stop` in case an assertion failed before that.
- The existing MCP e2e specs keep running against `attach`, waiting on
  `attached to`. The era-probe spec in `mcp.e2e.spec.ts` is rewritten, not
  retargeted: it counts `listening on` across every log in `.noesis/logs/`,
  which now include the daemon's. It asserts instead that no `server.json` and
  no `noesis-serve-*.log` exist before the first request that is not the probe,
  and exactly one of each after.

## Commits

1. `improvement(server): author documents and design docs over HTTP`: the five
   write routes, the body limit, `ErrorBody` with its encoder and decoder, route
   specs. Useful on its own.
2. `improvement(server): run the service as a registered daemon`:
   `ServerRegistration` with the instance and the reclaim guard, `health` with a
   version and instance, `attach`, `shutdown`, `AttachCounter`, the ordered
   shutdown, the grace shutdown under `--managed`, the log naming and sweep; the
   `serve` and `stop` subcommands. A bare `noesis` still runs today's single
   process, MCP and UI together, and registers nothing, so the plugin keeps
   working unchanged.
3. `improvement(server): serve MCP from a shim that calls the daemon`: `attach`,
   `DaemonClient`, the handlers on `hc`, the two daemon errors in
   `tool-handler.ts`, a bare `noesis` now running `serve`, the single-process
   mode removed, and `.mcp.json` launching `attach` in the same commit so no
   commit has the plugin start a process that does not speak MCP. The repository
   comment and the MCP e2e specs move here too.
4. `improvement(plugin): describe the shared service`: the README, `AGENT.md`,
   `ARCHITECTURE.md`, the package description and `dev` script.
5. `improvement(server): prove two sessions share one service`: the harness
   change and the shared-daemon e2e spec.

## Verification

Run the root CI scripts (typecheck, lint, knip, tests across all workspaces)
before pushing; check CI after. Then, from a sample repository with
`--plugin-dir` and `NOESIS_SERVICE_ENTRY` pointing at the checkout, open three
sessions and check `.noesis/server.json` names one pid, `ps` shows one `serve`
and three `attach`, one browser tab opened, and the UI shows a change created
from any of the three. Leave the sessions idle for a minute and check a tool
call still answers without reconnecting.
