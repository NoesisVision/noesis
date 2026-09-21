---
name: create-change
description: Create a new Noesis change — the unit of work a feature, fix, improvement or chore is tracked as, and the place its documents collect. Use when the user asks to start, open, register or create a change, or begins work on something Noesis does not track yet.
---

# Create a change

A change is the unit of work everything else in Noesis hangs off. You name
it, say what kind of work it is and give its tracker key when it has one; the
service derives the slug, starts the change in `discovery`, stamps
`created_at` and stores it under `.noesis/graph/changes/<slug>/`.

## Contract

- Shape: `${CLAUDE_PLUGIN_ROOT}/contracts/create-change.schema.json` is what
  you send; `change.schema.json` beside it is what comes back. Both are JSON
  Schema. Read them now, not from memory.

## Steps

1. **Name it.** `name` is the human title as people say it ("Hold a slot for
   ten minutes"), at most 120 characters: no ticket prefix, no type prefix,
   no trailing full stop. Ask when the user gave nothing to name it by.
2. **Pick the type**, one of `feature` (new behaviour), `fix` (a bug),
   `improvement` (better once, no new behaviour) or `chore` (recurring
   upkeep). Take it from what the user said; ask when it could be read two
   ways.
3. **Set the key** to the tracker key the user gave, shaped like `NOE-142`
   (two to eight capital letters, a dash, a number). Leave it out when there
   is none. Never invent one.
4. **Create** with the `create_change` tool (`name`, `type`, `key`). It takes
   these inline; there is no working file for a change.
5. **Report** the slug from the tool's answer. Every later tool refers to the
   change by that slug, so use it as returned and never derive it yourself.

## When the tool refuses

- **A change with that slug or key exists.** The slug comes from the name,
  so two names that read alike clash. Nothing was written. Tell the user
  which one clashes and ask whether to work on the existing change or
  create this one under a different name or key. Do not retry with a name you
  altered on your own.
- **The arguments do not fit the schema** (a key that is not `ABC-123`, an
  unknown type, an empty name). Correct the argument and call again.

## Rules

- Never write under `.noesis/` yourself; the tool does.
- Send only `name`, `type` and `key`. The slug, the status and `created_at`
  are the service's to set.
- One call creates one change. Do not create a change the user did not ask
  for, and do not split one request into several changes without asking.
