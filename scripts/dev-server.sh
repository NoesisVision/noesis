#!/usr/bin/env bash
#
# Runs the backend and frontend dev servers and guarantees they die with this
# script.
#
# `bun run --filter` does not forward signals to the workspace scripts it
# spawns: signalling it directly leaves `bun --watch src/main.ts` and vite
# orphaned to PID 1, still holding :3000 and :5173, and the next start then
# fails on the LadybugDB lock. A plain Ctrl+C happens to work, because the
# terminal signals the whole foreground process group rather than the parent
# — but anything that signals only the parent (an IDE stop button, a kill in
# a script) leaks both servers.
#
# `set -m` puts the child in a process group of its own, so the trap can take
# down that entire group by negated pgid, whichever way this script is ended.
set -euo pipefail
set -m

bun run --filter=backend --filter=frontend dev &
child=$!

shutdown() {
  # Clear the traps first: killing the group signals this shell too, and the
  # re-entered handler would otherwise loop.
  trap - INT TERM EXIT
  kill -- "-${child}" 2>/dev/null || true
  wait "${child}" 2>/dev/null || true
}
trap shutdown INT TERM EXIT

wait "${child}"
