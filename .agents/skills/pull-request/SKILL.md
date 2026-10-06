---
name: pull-request
description: >
  Open or update a pull request for the current branch: its title, its
  description and — whenever the change touches the UI — screenshots of what it
  looks like, published to the orphan `pr-screenshots` branch and shown in the
  description. Use when the user asks to open, create, raise or update a PR, or
  to write or refresh a PR description.
---

# Pull request

A PR is read by someone who did not watch it being made. The description says
what changed and why in the reader's words, and when the change is visible it
shows it: a reviewer should not have to check the branch out to see a header.

## Title and base

- The title follows the `commit-message` skill: one of its four types, a scope
  when one fits, imperative, at most 72 characters. A branch of several commits
  gets a title for the whole, not the first commit's.
- The base is `main` unless the user says otherwise. Push the branch first.

## Description

Match the PRs already merged (`gh pr list --state merged --limit 3 --json body`):

- One or two sentences on what the PR does.
- A `##` section per part of the change, as short bullets: what a reader will
  notice, then what moved in the code where it matters to a reviewer.
- What a reviewer must decide or might trip over, said plainly — a removed
  link, a changed default, a design-system change that needs `/design-sync`.
- `## Screenshots` when the UI changed (below).
- `## Testing`: what ran (`bun run ci`, a browser check) and, as plainly, what
  did not.
- End with the attribution line the session's instructions give.

Write it to a file and pass `--body-file`; a description edited later is
fetched with `gh pr view <n> --json body -q .body`, changed in that file and
put back with `gh pr edit <n> --body-file`.

## Screenshots, when the UI changed

The change touches the UI when the diff changes anything a reader sees: a
component, a stylesheet, a layout, a route's view under `server/frontend/src`,
or a design-system wrapper. Tests, types and pure data code alone do not. When
unsure, take them.

1. **Build and run the app** on an example project, so the shots show real
   data. The service opens its web UI only on a terminal (or for an MCP
   client), so give it one with `script`, and keep its stdin open:

   ```sh
   bun run --cwd server/frontend build:spa
   tail -f /dev/null | NOESIS_ROOT=$PWD/examples/qdoc-java NOESIS_SCANNER=dummy \
     PORT=3987 NOESIS_OPEN_BROWSER=0 \
     script -q /dev/null bun server/backend/src/main.ts > /tmp/noesis-ui.log 2>&1 &
   curl -s 127.0.0.1:3987/ui/changes/navigation   # the change ids to open
   ```

   Pick the example whose data shows the change best.

2. **Capture** each view the change touches with
   [`scripts/screenshot.ts`](scripts/screenshot.ts), into a scratch directory
   (never the repository):

   ```sh
   bun .agents/skills/pull-request/scripts/screenshot.ts \
     --url http://127.0.0.1:3987/changes/<id> --out <dir>/header-light.png \
     --selector header
   ```

   - Light **and** dark (`--scheme dark`) — the app supports both.
   - Wide (1440, the default) and phone (`--width 390 --height 800`) when the
     change is responsive or the header is involved.
   - `--selector` crops to the part that changed; `--hover` shows a hover state.
   - Name files for what they show: `header-dark.png`, `phone-menu.png`.

   The first run on a machine may need
   `bunx playwright-core install chromium-headless-shell`.

   Look at every shot before publishing it: a blank page, an error panel or a
   half-loaded view says something went wrong, not what the change looks like.

3. **Publish** them once the PR has a number (open it first):

   ```sh
   bun .agents/skills/pull-request/scripts/publish-screenshots.ts --pr <n> <dir>/*.png
   ```

   It commits the files to `<n>/` on the orphan `pr-screenshots` branch —
   never on the PR's branch, so no image is merged into `main` — and prints a
   Markdown image line per file, pinned to that commit. It touches neither the
   working tree nor the checked-out branch, and skips the pre-push hook, which
   checks code the branch does not hold.

4. **Show them** under `## Screenshots` in the description: a short caption per
   image or pair (light / dark side by side in a table reads well), then
   `gh pr edit <n> --body-file`.

5. **Stop the app**: `pkill -f "server/backend/src/main.ts"`.

New screenshots for an updated PR go through the same steps; publishing again
adds a commit on top, and the description's links move to it.
