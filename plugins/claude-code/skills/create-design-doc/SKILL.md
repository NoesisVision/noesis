---
name: create-design-doc
description: Design what a Noesis change does to the code's domain model — the modules, building blocks and behaviours it adds, modifies or removes, with their rules and scenarios — from the change's documents and the scanned system model, and store it in the change as a design document, or as several alternative ones, each designed by its own subagent, for the user to compare. Use when the user asks to design a change, model it, plan its implementation or write its design doc from the specs, notes or transcripts it collects.
argument-hint: [change-id] [number of designs] [instructions]
---

# Create a design document

A design document says what a change does to the implemented model: the
modules, building blocks and behaviours it adds, modifies or removes, with
their properties, rules and scenarios. It is a diff against the newest
system model — what the scanner found in the code — and never against an
earlier design document. You read the change's documents and the system
model, design the change as an experienced architect and analyst would,
write the design document to a JSON working file and hand that file's path
to `create_design_doc_in_change`. The service checks it against its contract
and the scan, mints its id and stores it in the change. When the user asks
for several alternatives, you prepare the ground once and hand each option
to a subagent of its own.

## Contracts

- Working file: `${CLAUDE_PLUGIN_ROOT}/contracts/design-document.schema.json`,
  with a worked example beside it, `design-document.example.json`.
- Baseline: `${CLAUDE_PLUGIN_ROOT}/contracts/system-model.schema.json`, the
  shape `get_newest_system_model` answers with.

Both are JSON Schema. Read them at step 6, not from memory.

## Modelling guidance

`${CLAUDE_PLUGIN_ROOT}/skills/create-design-doc/references/modelling.md`:
definitions, needs, modules, building block types, use cases and actors,
rules, scenarios. Read it at step 5.

## Steps

1. **Ask how many designs.** Unless the user already said, ask how many
   alternative design documents to generate: one design, or two, three or
   four options to compare, each designed by a subagent of its own. When
   step 2 must ask which change too, call `list_changes` first and ask both
   in one `AskUserQuestion` round.
2. **Pick the change.** Call `list_changes`. When the user named a change
   (an id, a name or a tracker key) and exactly one listed change matches,
   use its id. Otherwise ask the user which change to design, offering the
   listed changes by name, key and id, newest first. For a change Noesis
   does not track yet, use the `add-change` skill first.
3. **Read the sources.** Call `list_documents_in_change`, then
   `get_document_in_change` for every document it lists. The user's message
   is a source too, and so is any file the user points at; read those with
   your own file tool. When there is nothing to design from, ask for source
   material, offering the `add-document-to-change` skill. When sources
   disagree, trust them in this order: the user's message, files the user
   pointed at, the change's documents (newer before older), the system
   model. Note the needs as you read: who needs what, in the stakeholder's
   words, one need per distinct goal.
4. **Load the baseline.** Call `get_newest_system_model`. Scan first with
   `scan_system_model`, then call `get_newest_system_model` again, when
   there is no scan yet or the code has moved on since `scanned_at`: the
   last commit (`git log -1 --format=%cI`) is newer, or
   `git status --porcelain` lists changes outside `.noesis/`. An empty
   model is a green field: everything the design names is new. The model is
   the only baseline; its ids are the only ones `modified` and `removed` may
   name.
5. **Design.** Read the modelling guidance now, then work through:
   - **Needs.** The stakeholder goals the change answers, each with the
     stakeholder and a statement of who needs what and when. A need is a
     goal, never a solution.
   - **Modules.** Place the work in existing modules first. A new module
     only for a cohesive group of building blocks, under the module closest
     to it in meaning. A new root module needs the user's approval, always.
   - **Use cases and actors.** Every action triggered from outside the
     module by a command, event or query is a public behaviour. Its actors
     are the human personas that trigger it; reuse the actor names the
     system model already uses, verbatim.
   - **Building blocks and behaviours**, with their types, properties,
     `implements` and behaviour inputs and outputs. Take ready solutions
     from the sources, diagrams especially.
   - **Rules**, one per requirement statement, each with its category and
     type, the needs it answers (none for a design decision) and, when a
     source gives one, its rationale, attached at exactly one level.
   - **Scenarios** in given, when, then, attached to the rule they verify,
     else to the behaviour, else to the building block.

   Then look for contradictions between sources, missing information and
   places where several designs fit. Resolve one yourself only when a
   source states the answer explicitly. Ask the user about every other one,
   in one `AskUserQuestion` round, each question with two or three
   candidate answers. Continue only once the user has decided.

   With several designs, work through the list only as far as it takes to
   find the open questions and the places where designs diverge, and ask
   only about contradictions and missing information: the places where
   several designs fit are what the options explore. Then go on with
   [Several designs](#several-designs) instead of step 6.

6. **Diff against the baseline.** Read both contracts now. For every
   element and every part of one (property, rule, scenario, input, output,
   `implements` entry), ask whether the system model has it:
   - **Not in the model:** `added`, with every field given a value except
     `diagram`, which only an element worth drawing has.
   - **In the model and changed:** `modified`, with its id (a part's name,
     an output's type) and only the fields that change. The `description`
     of a property, an input, an output or a scenario is always a change
     note: `"Change note: "`, then what changes and why, so a reader sees
     why the part is in the diff. An element's `definition` never is: give
     it only when what the element is changes, and then write the whole new
     definition. Nor is a rule's `description`: it is the requirement's
     whole new statement. Say why a modified element or rule is in the diff
     in the design document's `description`.
   - **In the model and retired:** `removed`, by id (a part by name, an
     output by type). Remove a building block's behaviours with it.
   - **In the model and unchanged:** leave it out, even when the design
     refers to it. A reference resolves against the model.

   Nesting follows the same questions: inside an `added` element everything
   is added; a `modified` building block lists only the properties, rules
   and scenarios that change. A behaviour's input is a part known by its
   name, like a property; an output has no name and is known by its `type`,
   so an output of another type is one removed and one added. `implements`
   has no `modified`: a changed entry is removed and added. Needs are only
   ever `added`: no scan holds one, so there is nothing to modify or
   remove. A rename of an element in the model is a removal of the old id
   and an addition of the new one, and every reference to the old id moves
   to the new one.

7. **Find the scratch directory.** It is the absolute path named in the
   description of the `path` parameter of `create_design_doc_in_change`, of
   the form `.noesis/sessions/<session>/`. Take it from there, never from
   memory: it changes every session.
8. **Write the working file** into the scratch directory, e.g.
   `<scratch directory>/design-doc.json`: `name` (a human title, usually the
   change's), `description` (the overview: a condensed ADR of the
   decisions the design makes, their drivers and how they connect, with
   links to the elements they are about; read
   `${CLAUDE_PLUGIN_ROOT}/skills/create-design-doc/references/description.md`
   before writing it), `needs`, `modules`, `buildingBlocks` and
   `behaviours`. No `id`, no `implemented`. Write every field as
   `{ "value": … }` and never with `author`: you are the agent. Leave out a
   change set with nothing in it.
   Before saving, check that every reference — the `type` of a property, an
   input or an output, `implements` — names a building block this design
   adds or modifies, one the system model has, or a primitive, that
   nothing refers to an id the design removes, that every rule's `needs`
   names only needs the design adds, and that every `noesis:` link in
   `description` names an element this design adds, modifies or removes,
   or one the system model has.
9. **Save it.** Call `create_design_doc_in_change` with the change's id and
   the working file's `path`.
10. **Report** the id the tool answered with, what the design adds, modifies
    and removes (counted per modules, building blocks and behaviours), the
    needs no rule answers, the rules no need asks for, and every assumption
    you made that no source stated.

## Several designs

Each option is designed and saved by a subagent of its own, from the same
sources, baseline and answers; you choose the directions and compare the
results.

1. **Choose the directions**, one per option: a paragraph naming the choice
   the option makes where designs diverge — which module the work lands in,
   where an aggregate's boundary runs, which building block owns a rule, a
   new building block or an extended one, a direct call or an event — and
   what it trades. They differ in substance, not wording; put the one you
   would recommend first. When the sources leave fewer designs worth
   comparing than the user asked for, say so and ask whether to generate
   fewer.
2. **Tell the user** the directions, one line each.
3. **Brief each subagent.** Find the scratch directory as in step 7. Fill
   `${CLAUDE_PLUGIN_ROOT}/skills/create-design-doc/references/alternative-brief.md`
   once per option, every placeholder with an absolute path or a literal
   value, since a subagent reads no variable: the design document is named
   `<name> — option <n>: <its direction in a few words>`, its working file
   is `design-doc-option-<n>.json`.
4. **Launch them together:** one general-purpose subagent per option, all in
   one message so they run in parallel. Do not design an option yourself,
   and do not edit or save one a subagent wrote.
5. **Compare and report** once every subagent has answered: a table of the
   options with id, direction and what each adds, modifies and removes;
   then, per option, its trade-offs and assumptions; then the one you would
   pick and why. Name an option that failed, with its reason, and offer to
   run it again. Every saved option stays in the change.

## Ids and names

- Ids spell the path: `module|sales.refunds`,
  `building_block|sales.refunds.Refund`,
  `behavior|sales.refunds.Refund.issue`. A building block always sits in a
  module and a behaviour in a building block; its `name` is the last
  segment of its id.
- Names match the code the scanner reads, because the next scan is compared
  to them: follow the casing and conventions of the ids in the system model
  (`ApplyOn` in C#, `getCurrent` in Java); in a green field, those of the
  language the code is written in. One behaviour per method name:
  overloads are one behaviour.
- A name never holds `.` or `|`, rule and scenario names included.
- Names are English, or the code's identifiers. Every definition, every
  description and every given, when and then is in the dominant language of
  the sources; do not translate them.

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
  - _write every field as the agent_: remove `author` from the field.
  - _the design document states no such need_: add the need to `needs`, or
    take its id out of the rule's `needs`.
  - _the rule's type belongs to another category_: pick a `ruleType` of the
    rule's `category`, or the `category` of its type.
  - _a module holds only quality and constraint rules_: move the business
    rule to the building block or behaviour it governs.

  Fix every line, then call again; repeat until the tool accepts the file.

- **There is no such change.** The id did not come from `list_changes`.
  Call it again and ask the user, as in step 2.

## Rules

- Design only what the sources support. A rule, scenario or property no
  source states is an assumption: ask about it, or name it in the report.
  Choosing building blocks and behaviours that realise the sources is the
  design's job.
- Never write under `.noesis/` yourself, except the working file in the
  scratch directory; the tool stores the design document.
- Never write or derive an id for the design document: the service mints
  it. Every call creates a new design document. Do not call
  `update_design_doc_in_change`: revising a design document is the
  `update-design-doc` skill's job, or the user's in the Noesis page.
- The diff baseline is the newest system model and nothing else: not an
  earlier design document, not your memory of the code.
