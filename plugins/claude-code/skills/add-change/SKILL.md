---
name: add-change
description: Add a Noesis change — the unit of work a feature, fix, improvement or chore is tracked as, and the place its documents collect — or update one. Use when the user asks to start, open, register, create or rename a change, or begins work on something Noesis does not track yet.
---

# Add a change

A change is the unit of work everything else in Noesis hangs off. You write
the change to a JSON working file — its id, name, type and tracker key — and
hand that file's path to the `add_change` tool. The service stores it under
`.noesis/graph/changes/<id>/`. A new change starts in `discovery`.

## Contract

- Shape: `${CLAUDE_PLUGIN_ROOT}/contracts/change.schema.json`, a JSON Schema.
  Read it now, not from memory. It is both the working file you write and
  what the tool answers with.

## Steps

1. **Check what exists.** Call `list_changes`. When the user means a change
   already listed (by name, key or id), you are updating it: take its `id`
   and `status` from the list. Otherwise you are creating a new one.
2. **Name it.** `name` is the human title as people say it ("Hold a slot for
   ten minutes"), at most 120 characters: no ticket prefix, no type prefix,
   no trailing full stop. Ask when the user gave nothing to name it by.
3. **Pick the type**, one of `feature` (new behaviour), `fix` (a bug),
   `improvement` (better once, no new behaviour) or `chore` (recurring
   upkeep). Take it from what the user said; ask when it could be read two
   ways.
4. **Set the key** to the tracker key the user gave, shaped like `NOE-142`
   (two to eight capital letters, a dash, a number). Leave it out when there
   is none. Never invent one.
5. **Get the id.** For a new change, mint it from the name:

   ```
   bun "${CLAUDE_PLUGIN_ROOT}/scripts/entity-id.ts" "<name>"
   ```

   It prints today's date and the name as a slug, e.g.
   `2026-09-24-hold-a-slot-for-ten-minutes`. To update a change, reuse its
   id from `list_changes`, even when the name changed: an id never changes.

6. **Find the scratch directory.** It is the absolute path named in the
   description of the `path` parameter of `add_change`, of the form
   `.noesis/sessions/<session>/`. Take it from there, never from memory: it
   changes every session.
7. **Write the working file** into the scratch directory, e.g.
   `<scratch directory>/change.json`: `id`, `name`, `type`, `key` and
   `description` (a paragraph on what the change is about, or empty). Leave
   `status` out for a new change; for an update, carry the `status` that
   `list_changes` returned.
8. **Add** with the `add_change` tool (the working file's `path`).
9. **Report** the id and whether the tool created or updated the change.
   Every later tool refers to the change by that id.

## When the answer surprises you

- **It says `Updated` when you meant to create.** An existing change had the
  same id — the same name on the same day — and has now been overwritten
  with what you wrote. Tell the user straight away which change it was.
- **The working file does not fit the contract** (a key that is not
  `ABC-123`, an unknown type, an empty name, an id that is not a date and a
  slug). Nothing was written. The issue list gives the path of each problem;
  correct the file and call again.

## Rules

- Never write under `.noesis/` yourself, except the working file in the
  scratch directory; the tool stores the change.
- Never derive or edit an id by hand: mint it with the script, or reuse the
  stored one.
- One call adds one change. Do not add a change the user did not ask for,
  and do not split one request into several changes without asking.
