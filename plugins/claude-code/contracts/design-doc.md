<!-- Copied from packages/shared-contracts/src/design-doc.md by @noesis-vision/noesis 0.1.0-beta.4. Do not edit: run `bun run generate`. -->

# Design documents

Companion to `design-doc.ts` and `design-doc-ref.ts`. The schema is the shape;
this is the meaning.

## What a design document is

A design document describes one change to the system: what it is for, who is
involved, which use cases it adds or alters, and which building blocks carry
them. It reads top to bottom in the order the schema lists its fields — goal,
business context, outcomes, scope, actors, then the model. Write it in that
order; a reader stops where their question is answered.

It is a normalised model, not a tree. Use cases, building blocks, behaviours
and actors are flat lists related by id. Nothing is nested that can be
referenced from more than one place.

## Recognising model-describing content

When reading a conversation or a draft, these are the things that belong in a
design document:

- A sentence about what someone does with the system (verb first, one actor,
  one outcome) is a **use case**. Its inputs and outputs are **fields**.
- A sentence that must always hold — "a slot cannot be held twice" — is a
  **rule** of the use case it constrains. Classify it only when the type is
  obvious.
- A noun the domain experts name and reason about — an order, a slot hold, a
  booking — is a **building block**. Choose `aggregate` for a consistency
  boundary, `entity` for something with identity inside it, `value_object` for
  something compared by value, `application_service` for the thing that
  orchestrates a use case.
- A thing the system does in response to a request or an event —
  `SlotHold.place()`, `AppointmentBooked` — is a **behaviour** of a building
  block. Only the behaviour a use case enters through names the use case.
- "How fast", "how available", "who may" is a **quality attribute**.
- A concrete example with setup, action and outcome is an **acceptance
  scenario**. Keep the Gherkin plain; use an outline only when the same steps
  run over a table of values.

Anything about why the change is happening or how success will be measured
goes into the goal, business context and outcomes, not into the model.

## Rules the service enforces on write

The schema checks each object alone. The service then checks the document as
a whole and rejects it with the issue list when any of these fail:

- Every `id` is non-empty and unique across the whole document, at every depth.
- Every `*Id` field resolves to an element that exists:
  `applicationServiceId` to a building block of type `application_service`,
  `boundedContextId` to a bounded context, `domainModuleId` to a module,
  `buildingBlockId` to a building block, `actorIds` to actors, `implements`
  to building blocks.
- A use case's `behaviourId` and that behaviour's `useCaseId` point at each
  other, or both are null.
- A module belongs to the same bounded context as the blocks in it.
- An actor is referenced at most once by one use case.
- A scenario of kind `scenarioOutline` has an `examples` table whose rows have
  as many cells as there are headers; a plain `scenario` has none.

## Authorship

`author` and `descriptionAuthor` say who wrote a piece of prose. `human` text
is a person's words: keep it as written and ask before rewriting. New text the
agent writes is `agent`. There are no `*_locked` fields in a design document;
authorship is the marker.

## Refs

An `ElementRef` addresses one place: `{ kind: "element", id }` for anything
with an id, `{ kind: "slot", ownerId, path }` for a field on an element that
is not an element itself (`["output", "summary"]`). Validation issues use
`#<id>` for element refs.
