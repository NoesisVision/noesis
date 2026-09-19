---
name: create-design-doc
description: Write a new Noesis design document for a change — goal, context, outcomes, scope, actors, use cases, building blocks and behaviours — from the wiki, the system model and what the user says. Use when the user asks to design a change, write a design doc, or specify a feature.
---

# Create a design document

A design document describes one change to the system. You write it as one
JSON file; the service validates it (shape and whole-document integrity),
mints its id, and stores it under the change.

## Contract

- Shape: `${CLAUDE_PLUGIN_ROOT}/contracts/design-docs/model/design-doc.ts` and
  `${CLAUDE_PLUGIN_ROOT}/contracts/design-docs/model/design-doc-ref.ts`. Read them now, not from
  memory.
- A complete example: `${CLAUDE_PLUGIN_ROOT}/contracts/design-docs/model/design-doc.fixture.ts`.

## Steps

1. **Pick the change.** Call `list-changes`; ask if the user did not say.
   Call `list-design-docs` for it: if a document for this design already
   exists, use the `update-design-doc` skill instead.
2. **Ground the design.** Call `search-knowledge-graph` for the subjects
   involved and read the matching wiki topics and decisions under
   `.noesis/graph/wiki/`. Call `scan-system-model` when `.noesis/graph/system-model/` is
   missing or older than the code, then read the relevant system-model files,
   so building blocks that already exist in the code are named as they are,
   not reinvented. Ask the user what the wiki does not answer.
3. **Write the document** in the order the schema lists its fields. Every
   element gets a short, readable id unique across the document
   (`uc-book-appointment`, `svc-booking`, `rule-hold-ten-minutes`). Every
   `*Id` field must name an element that exists and is of the right kind; a
   use case's entry behaviour and that behaviour's `useCaseId` point at each
   other. Set `date` to today (YYYY-MM-DD) and leave `id` out or set any
   placeholder. Text you write is `author: "agent"`; text the user dictated
   verbatim is `"human"`.
4. **Write the working file** to the session scratch directory named in the
   server instructions, for example `.noesis/tmp/<session>/design-doc.json`.
5. **Validate** with `validate` (`contract: "design-document"`, the path).
   Fix each issue in place — the list gives the path, what was expected, what
   it found and a one-line fix — and validate again until clean.
6. **Create** with `create-design-doc` (`change`, the path). Tell the user the
   document's id and path from the tool's answer; the browser ui shows it
   after the next re-index.

## Rules

- Never write under `.noesis/` yourself; the tool does.
- Do not invent facts about the domain. What the wiki, the system model and
  the user did not say is a question, not a guess.
