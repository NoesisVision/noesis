---
name: create-design-doc
description: Design what a Noesis change does to the code's domain model — the modules, building blocks and behaviors it adds, modifies or removes, the rules those behaviors follow and the scenarios that illustrate them — from the change's documents and the scanned system model, and store it in the change as a design document, or as several alternative ones, each designed by its own subagent, for the user to compare. Use when the user asks to design a change, model it, plan its implementation or write its design doc from the specs, notes or transcripts it collects.
argument-hint: [change-id] [number of designs] [instructions]
---

# Create a design document

A design document says what a change does to the implemented model: the
modules, building blocks and behaviors it adds, modifies or removes, the
rules those behaviors follow, the scenarios that illustrate the rules, and
the relations between them all. It is a diff against the newest
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
     stakeholder the sources name, or none, and a statement of what is
     needed and when. A need is a
     goal, never a solution.
   - **Modules.** Place the work in existing modules first. A new module
     only for a cohesive group of building blocks, under the module closest
     to it in meaning. A new root module needs the user's approval, always.
   - **Actors and manual processes.** Every goal a person reaches by
     driving the system is a manual process (`manualProcesses`): the work
     they do by hand, whose `invokes` relations call the system's
     behaviors in order. The actor who does it (`actors`) `performs` it;
     reuse the actor names the system model already uses, verbatim. The
     behaviors a process invokes are behaviors of application services or
     in adapters.
   - **Building blocks and behaviors**, with their types, and the
     **relations** between them: a block's state (`has_state`), what it
     works with (`has_collaborator`), what it extends (`extends`), a behavior's inputs (`has_input`) and output
     (`has_output`), and what calls what (`invokes`, from a behavior or a
     manual process). Take ready solutions
     from the sources, diagrams especially.
   - **Rules**, one per requirement statement, each with its kind, the
     needs it answers (none for a design decision) and, when a source gives
     one, its rationale, and the behaviors that follow it (`governs`). A
     quality or a constraint no behavior follows is no rule.
   - **Scenarios**, at least one per rule, each illustrating one rule
     (`illustrates`), as the Gherkin steps of given, when and then they
     become, the `when` calling the behavior that governs the rule.

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
   element, rules and scenarios included, and every relation, ask whether
   the system model has it:
   - **Not in the model:** `added`, with every field given a value except
     `diagram`, which only an element worth drawing has, and a rule's
     `rationale`, which only a source gives.
   - **In the model and changed:** `modified`, with its id (a relation's
     key) and only the fields that change. The `description`
     of a scenario is always a change note: `"Change note: "`, then what
     changes and why, so a reader sees why the scenario is in the diff. An
     element's `definition` never is: give it only when what the element is
     changes, and then write the whole new definition. Nor is a rule's
     `description`: it is the requirement's whole new statement. Say why a
     modified element, rule or relation is in the diff in the design
     document's `description`.
   - **In the model and retired:** `removed`, by id (a relation by its
     key). Remove a building block's behaviors and relations with it, and a
     rule's scenarios and relations with the rule.
   - **In the model and unchanged:** leave it out, even when the design
     refers to it. A reference resolves against the model.

   Every element is in a list of its own, rules in `rules` and scenarios in
   `scenarios` too, never inside a module, a block or a behavior.
   Relations are one list, `relations`, beside the elements, each
   `{ "kind", "from", "to", … }`: `has_state` (a block's
   field: `name`, `to` and `cardinality` are fields), `has_collaborator`
   (a block it works with: `name`, and `to` a field; no cardinality),
   `has_input` (a
   behavior's parameter, the same way, plus `position`, a field: where it
   stands in the signature, counting from 1), `has_output` (a behavior's result:
   `to` is its key, `cardinality` a field), `extends`, `exposes`,
   `contains`, `invokes` (from a behavior or a manual process; `order` a
   field), `governs` (from a behavior to a rule it follows),
   `illustrates` (from a scenario to its rule) and `performs` (from an
   actor to a manual process). The
   kind of the block a
   slot points at picks the relation: a primitive or a value of the domain
   (`aggregate`, `entity`, `value_object`, `command`, `query`, `event`) is
   `has_state`, any other block `has_collaborator`. A `has_state`,
   `has_collaborator` or `has_input` is known by its holder and `name`, so its type may change in place; a
   `has_output` is known by its `to`, so an output of another type is one
   removed and one added; `extends`, `governs`, `illustrates` and
   `performs` have nothing to modify. `cardinality`
   is `1`, `0..1`, `0..*` or `1..*`: a collection and an optional value are
   told apart by it, never by the type. Both ends of an added relation
   exist, in the design or in the model; a `contains`, `exposes` or
   `illustrates` only says what the ids already say, so write one only
   when it does. Every added rule has an added `governs` to it. Needs
   are only ever `added`: no scan holds one, so there is nothing to modify
   or remove; nor are manual processes, which no scan finds. A rename of an element in the model is a removal of the old
   id and an addition of the new one, and every reference to the old id
   moves to the new one.

7. **Find the scratch directory.** It is the absolute path named in the
   description of the `path` parameter of `create_design_doc_in_change`, of
   the form `.noesis/sessions/<session>/`. Take it from there, never from
   memory: it changes every session.
8. **Write the working file** into the scratch directory, e.g.
   `<scratch directory>/design-doc.json`: `name` (a human title, usually the
   change's), `description` (the overview, as the contract states it;
   read
   `${CLAUDE_PLUGIN_ROOT}/skills/create-design-doc/references/description.md`
   before writing it), `needs`, `modules`, `buildingBlocks`, `behaviors`,
   `rules`, `scenarios`, `actors`, `manualProcesses` and `relations`. No `id`, no `implemented`. Write every field as
   `{ "value": … }` and never with `author`: you are the agent. Leave out a
   change set with nothing in it.
   Before saving, check that every end of a relation — the `to` of a
   `has_state`, `has_collaborator`, `has_input` or `has_output`, both ends of an `extends`,
   an `invokes`, a `governs`, an `illustrates` or a `performs` — names an
   element this
   design adds, one the system model has, or a primitive, that
   nothing refers to an id the design removes, that every added rule has a
   `governs` and every added scenario an `illustrates` to the rule its id
   is under, that every rule's `needs`
   names only needs the design adds, and that every `noesis:` link in
   `description` names an element this design adds, modifies or removes,
   one the system model has, or a need the design states.
9. **Save it.** Call `create_design_doc_in_change` with the change's id and
   the working file's `path`.
10. **Report** the id the tool answered with, what the design adds, modifies
    and removes (counted per modules, building blocks, behaviors, rules and
    scenarios), the needs no rule answers, the rules no need asks for, the
    requirements left to the documents because no behavior follows them,
    and every assumption you made that no source stated.

## Several designs

Each option is designed and saved by a subagent of its own, from the same
sources, baseline and answers; you choose the directions and compare the
results.

1. **Choose the directions**, one per option: a paragraph naming the choice
   the option makes where designs diverge — which module the work lands in,
   where an aggregate's boundary runs, which behavior governs a rule, a
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
  module and a behavior in a building block; its `name` is the last
  segment of its id.
- A rule's id is the path of the module of the behavior that governs it,
  then its name: `rule|sales.refunds.Refund never exceeds paid amount`. A
  scenario's is its rule's path, then its name:
  `scenario|sales.refunds.Refund never exceeds paid amount.Refunding one line of a paid order`.
- Names match the code the scanner reads, because the next scan is compared
  to them: follow the casing and conventions of the ids in the system model
  (`ApplyOn` in C#, `getCurrent` in Java); in a green field, those of the
  language the code is written in. One behavior per method name:
  overloads are one behavior.
- A name never holds `.` or `|`, rule and scenario names included.
- Names are English, or the code's identifiers. Every definition, every
  description and every scenario step is in the dominant language of
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
  - _a rule enters the model only through a behavior that follows it_: add
    a `governs` relation from that behavior to the rule, or drop a rule no
    behavior follows.
  - _neither the design nor the scanned model has this element_: an end of
    the relation names an id that is misspelt or not added yet. Add the
    element, or point the relation at one that exists.
  - _what holds what is in the ids_: a `contains`, `exposes` or
    `illustrates` disagrees with an id's path. A scenario's id is its
    rule's path and its own name, a behavior's its block's: fix the id, or
    drop the relation.

  Fix every line, then call again; repeat until the tool accepts the file.

- **There is no such change.** The id did not come from `list_changes`.
  Call it again and ask the user, as in step 2.

## Rules

- Design only what the sources support. A rule, scenario or property no
  source states is an assumption: ask about it, or name it in the report.
  Choosing building blocks and behaviors that realise the sources is the
  design's job.
- Never write under `.noesis/` yourself, except the working file in the
  scratch directory; the tool stores the design document.
- Never write or derive an id for the design document: the service mints
  it. Every call creates a new design document. Do not call
  `update_design_doc_in_change`: revising a design document is the
  `update-design-doc` skill's job, or the user's in the Noesis page.
- The diff baseline is the newest system model and nothing else: not an
  earlier design document, not your memory of the code.
