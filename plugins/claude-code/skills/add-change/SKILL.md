---
name: add-change
description: Add a Noesis change — the unit of work a feature, fix, improvement or chore is tracked as, and the place its documents collect — or update one. Use when the user asks to start, open, register, create or rename a change, or begins work on something Noesis does not track yet.
---

# Add a change

A change is the unit of work everything else in Noesis hangs off. You write
the change to a JSON working file — its name, type and tracker key — and hand
that file's path to `create_change` for a new change or to `update_change`
for one that exists. The service stores it under `.noesis/graph/changes/`.
The service mints a new change's id from today's date and the name; you never
write an id into the file.

## Contracts

- New change: `${CLAUDE_PLUGIN_ROOT}/contracts/new-change.schema.json`.
- Update: `${CLAUDE_PLUGIN_ROOT}/contracts/change.schema.json`, which adds
  `status`.

Both are JSON Schema. Read the one you need now, not from memory.

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
5. **Find the scratch directory.** It is the absolute path named in the
   description of the `path` parameter of `create_change`, of the form
   `.noesis/sessions/<session>/`. Take it from there, never from memory: it
   changes every session.
6. **Write the working file** into the scratch directory, e.g.
   `<scratch directory>/change.json`: `name`, `type`, `key` and
   `description` (a paragraph on what the change is about, or empty). No
   `id`. For an update, also carry the `status` that `list_changes`
   returned, unless the user moves the change on.
7. **Save it.** For a new change, call `create_change` with the working
   file's `path`. For an update, call `update_change` with the change's `id`
   and the `path`; the id stays as it was, even when the name changed.
8. **Report** the id the tool answered with. Every later tool refers to the
   change by that id.

## When the tool refuses

- **The working file does not fit the contract** (a key that is not
  `ABC-123`, an unknown type, an empty name). Nothing was written. The issue
  list gives the path of each problem; correct the file and call again.
- **`update_change` finds no such change.** The id did not come from
  `list_changes`. Call it again and ask the user which change they meant.

## Rules

- Never write under `.noesis/` yourself, except the working file in the
  scratch directory; the tool stores the change.
- Never write or derive an id: the service mints it, and an update takes the
  one `list_changes` lists.
- Every `create_change` call creates a new change, even for a name used
  before. Do not create a change the user did not ask for, and do not split
  one request into several changes without asking.
