---
name: update-design-doc
description: Revise an existing Noesis design document — add or change use cases, rules, building blocks, scenarios — keeping human-authored text intact. Use when the user asks to update, extend, revise or fix a design doc.
---

# Update a design document

An update is a whole-document replacement under the same id. You read the
current file, produce the revised document, and the service validates and
stores it.

## Contract

- Shape: `${CLAUDE_PLUGIN_ROOT}/contracts/design-doc.ts` and
  `${CLAUDE_PLUGIN_ROOT}/contracts/design-doc-ref.ts`.
- Meaning and the integrity rules: `${CLAUDE_PLUGIN_ROOT}/contracts/design-doc.md`.

## Steps

1. **Find the document.** Call `list-changes`, then `list-design-docs` for
   the change. Read the current document from the path the tool gives (under
   `.noesis/graph/changes/<change>/design-docs/`).
2. **Ground the revision** as for a new design: `search-knowledge-graph`, the
   wiki, the system model, and the user.
3. **Revise the whole document.** Keep every existing element id; add new
   elements with new ids; remove only what the user asked to remove. Text
   marked `author: "human"` or `descriptionAuthor: "human"` is a person's
   words: keep it exactly as it is. If the change the user wants requires
   altering human text, say so and ask before doing it. Keep `*Id`
   references consistent with what you add or remove; keep the `id` field as
   it was (the service ignores it anyway).
4. **Write the working file** to the session scratch directory named in the
   server instructions.
5. **Validate** with `validate` (`contract: "design-document"`, the path)
   until clean.
6. **Update** with `update-design-doc` (`change`, `id`, the path). Tell the
   user what changed.

## Rules

- Never write under `.noesis/` yourself; the tool does.
- Whole replacement means everything not in your file is gone. Start from the
  current document, never from scratch.
