---
name: update-design-doc
description: Revise an existing Noesis design document as the user asks — add, change, move, rename or remove its needs, modules, building blocks, behaviours, rules, scenarios or diagrams — starting from the version stored now, edits made in the Noesis page included, and store it in place under the same id. Use when the user asks to change, revise, correct, extend, rework or apply feedback to a design document (design doc) of a change.
argument-hint: [change-id] [design-doc-id] [what to change]
---

# Update a design document

A design document says what a change does to the implemented model, as a
diff against the newest system model. Updating one revises that diff in
place: you fetch the design document as it is stored now, edit it as the
user asks, and hand it back to `update_design_doc_in_change`, which checks it
against its contract and the scan and replaces it under the same id. You
change what the request reaches and what has to change with it, and leave
everything else exactly as it was.

## Contracts

- Working file: `${CLAUDE_PLUGIN_ROOT}/contracts/design-document.schema.json`,
  with a worked example beside it, `design-document.example.json`.
- Baseline: `${CLAUDE_PLUGIN_ROOT}/contracts/system-model.schema.json`, the
  shape `get_newest_system_model` answers with.

Both are JSON Schema. Read them at step 6, not from memory.

## Modelling guidance

`${CLAUDE_PLUGIN_ROOT}/skills/create-design-doc/references/modelling.md`:
definitions, needs, modules, building block types, use cases and actors,
rules, scenarios. A revision follows it as a new design does. Read it at
step 6.

## Steps

1. **Pick the change.** Call `list_changes`. When the user named a change
   (an id, a name or a tracker key) and exactly one listed change matches,
   use its id. Otherwise ask the user which change, offering the listed
   changes by name, key and id, newest first.
2. **Pick the design document.** Call `list_design_docs_in_change`. When the
   user named one, or the change has exactly one, use its id. Otherwise ask
   which to revise, offering them by name and id. When the change has none,
   there is nothing to update: offer the `create-design-doc` skill.
3. **Ask before revising an implemented design.** When the listing marks the
   design document implemented, the code already follows it and the scanner
   replays it. Ask whether to revise it anyway or to design the follow-up
   as a new design document with `create-design-doc`.
4. **Fetch the newest version as a working file.** Find the scratch
   directory: the absolute path named in the description of the
   `workingFile` parameter of `get_design_doc_in_change`, of the form
   `.noesis/sessions/<session>/`. Take it from there, never from memory: it
   changes every session. Call `get_design_doc_in_change` with the change,
   the id and `workingFile: "design-doc.json"`. The service writes the
   design document there as it is stored now, without `id` and
   `implementedAt`, and answers with the path. Fetch it anew for every
   revision, even one you made earlier in this session: a person may have
   edited it in the Noesis page since. Read the working file whole.
   Then list the fields a person wrote or accepted in the Noesis page:

   ```
   bun "${CLAUDE_PLUGIN_ROOT}/skills/update-design-doc/scripts/human-fields.ts" \
     "<scratch directory>/design-doc.json"
   ```

   It prints each one's path and value and changes nothing. These are the
   accepted fields; step 6 asks before touching any of them.

5. **Load what the revision needs.**
   - **The request.** The user's message is the main source: what to
     change and why. Note every edit it asks for.
   - **The sources.** When the request refers to the change's documents,
     or adds a need, a rule or a scenario, call `list_documents_in_change`
     and `get_document_in_change` for the documents that bear on it. A new
     need comes from a source, never from you.
   - **The baseline.** Call `get_newest_system_model`. Scan first with
     `scan_system_model`, then call `get_newest_system_model` again, when
     there is no scan yet or the code has moved on since `scanned_at`: the
     last commit (`git log -1 --format=%cI`) is newer, or
     `git status --porcelain` lists changes outside `.noesis/`. Its ids are
     the only ones `modified` and `removed` may name.

   When sources disagree, trust them in this order: the user's message,
   files the user pointed at, the change's documents (newer before older),
   the design document as stored, the system model.

6. **Plan the revision.** Read the contracts and the modelling guidance
   now. List each edit the request asks for, then follow each one through
   the design document to everything that must change with it:
   - **References.** The `type` of a property, an input or an output,
     `implements`, a rule's `needs`: each names a building block this design
     adds or modifies, one the system model has, a primitive, or a need this
     design adds. A rename moves every reference to the old id or name.
   - **Ids and names.** Ids spell the path (`building_block|sales.refunds.Refund`),
     so moving or renaming a module or a building block renames every
     element beneath it, and a name is always the last segment of its id.
     Follow the casing of the ids in the system model.
   - **Diagrams.** Every diagram that draws a changed element: a module's
     flowchart, a behaviour's sequence diagram, an aggregate's entity
     diagram.
   - **Rules and scenarios.** A rule or scenario that states what the
     revision changes is rewritten with it; one that no longer holds is
     dropped; a new requirement is a new rule, attached at exactly one
     level, with its scenarios.
   - **The description.** The design document's `description` says what
     the design covers and why, including why each element it modifies
     changes. Revise it to match.

   Leave everything the request does not reach exactly as stored, wording
   included.

   Then check the plan against the accepted fields of step 4. An edit
   touches an accepted field when it gives it another value, turns it into
   `{ "changed": false }`, deletes the item that holds it, or renames or
   moves the element that holds it (its path changes, so it is a new field).
   Ask the user before every such edit, even one the request names
   explicitly: name the field by its path, quote its current value and the
   value you propose, and offer to change it or to keep it. Change an
   accepted field only on a yes. On a no, keep it as stored and rework the
   plan around it; when the request cannot be met without it, say so.

   Also look for contradictions between the request and the design, missing
   information and places where several revisions fit. Resolve one yourself
   only when a source states the answer explicitly. Ask about every other
   one in the same `AskUserQuestion` round as the accepted fields, each
   question with two or three candidate answers (several rounds when there
   are more than four questions). Continue only once the user has decided.

7. **Edit the working file in place**, one targeted edit at a time with
   your file edit tool; never rewrite the whole file. The diff against the
   newest system model follows the same questions as a new design:
   - **Not in the model:** `added`, with every field given a value except
     `diagram`. Changing an element that is only in `added` is editing that
     item; dropping it is deleting the item from `added`, never listing it
     under `removed`.
   - **In the model and changed:** `modified`, with its id and only the
     fields that change. The `description` of a property, an input, an
     output or a scenario is a change note: `"Change note: "`, then what
     changes and why. An element's `definition` is never one, nor is a
     rule's `description`.
   - **In the model and retired:** `removed`, by id. Remove a building
     block's behaviours with it.
   - **In the model and unchanged:** left out. A rename of an element in
     the model is a removal of the old id and an addition of the new one.

   Write a field you change as `{ "value": … }`, without `author`: the
   service records it as the agent's. That holds for an accepted field the
   user let you change too, so a person accepts it again in the page. Every
   field you leave alone stays exactly as the working file holds it,
   `author` included: an accepted field you do not change stays the
   person's. Keep `implemented` as it was. Leave out a change set that ends
   up empty.

8. **Save it.** Call `update_design_doc_in_change` with the change's id, the
   design document's id and the working file's `path`. The id stays as it
   was, even when the name changes.
9. **Report** what the revision changed, counted per needs, modules,
   building blocks and behaviours added, modified and removed by this
   revision (not by the whole design); the accepted fields the user let you
   change, which now wait to be accepted again, and the ones kept because
   the user said no; the needs no rule answers and the rules no need asks
   for that the revision introduced; and every assumption you made that no
   source stated.

## When the tool refuses

- **The working file does not fit the contract.** Nothing was written. The
  issue list gives the path of each problem; correct the file and call
  again.
- **The design breaks its rules.** Nothing was written. Each line names a
  field and what to do:
  - _the scanned model has no such element or part_: the id is misspelt,
    or the element is new and belongs in `added`. Check it against the
    system model.
  - _nothing is scanned yet_: there was no scan when the tool checked.
    Scan with `scan_system_model` and call again.
  - _the item is new, so this field needs a value_: give that field of the
    added item a `{ "value" }`.
  - _a human wrote or accepted this field with another value, or not at
    all_: the field carries `"author": "human"` but is not the accepted
    field the stored version holds at that path. When the user let you
    change it, take `author` out. Otherwise restore it exactly as step 4's
    list shows it, and ask before changing it.
  - _the design document states no such need_: add the need to `needs`, or
    take its id out of the rule's `needs`.
  - _the rule's type belongs to another category_: pick a `ruleType` of the
    rule's `category`, or the `category` of its type.
  - _a module holds only quality and constraint rules_: move the business
    rule to the building block or behaviour it governs.

  Fix every line, then call again; repeat until the tool accepts the file.
  An element the newest scan dropped since the design was written fails
  the same way: say so in the report, and ask the user before restructuring
  more of the design than the request reaches.

- **There is no such change or design document.** The id did not come from
  `list_changes` or `list_design_docs_in_change`. Call them again and ask
  the user, as in steps 1 and 2.

## Rules

- A field a person wrote or accepted is theirs: never change, empty or
  delete one, nor rename or move what holds it, without the user's yes, and
  never write a field in a person's name. One you leave alone stays theirs.
- Revise only what the request reaches and what must change with it. A
  rule, scenario or property no source states is an assumption: ask about
  it, or name it in the report.
- Never write under `.noesis/` yourself, except the working file in the
  scratch directory; the tool stores the design document.
- Never create a design document here: a new design, or an alternative to
  compare, is the `create-design-doc` skill's job. Never change a design
  document's id.
- The diff baseline is the newest system model and nothing else: not
  another design document, not an earlier version of this one, not your
  memory of the code.
- Names are English, or the code's identifiers. Every definition,
  description and given, when and then is in the dominant language of the
  design document; do not translate it.
