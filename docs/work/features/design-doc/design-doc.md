# Collaborative Design Document Workspace

## Product and UX specification

**Status:** Draft  
**Date:** 2026-08-16  
**Purpose:** Define the agreed product direction and UX requirements for a visual, collaborative workspace used to create and evolve structured design documents for software-building agents.

> **First-iteration scope.** The chosen interaction model is the document view
> (`prototypes/document-view.html`), and the build order is `plan.md`. This specification keeps the
> full product direction, but the first iteration deliberately leaves out the visual canvas
> (section 8), the Product/Technical lens (2.1, 9.2), the use-case catalogue, filters and dashboard
> (7.1–7.2), sequence diagrams (12), the behaviour graph and scenario paths (10.2, 12.3, 14.4–14.5),
> building-block behavioural scenarios (11.1), and agent mentions in comments (3.2, 13). Sections
> that are deferred say so inline. Nothing here is cancelled — it is sequenced.

---

## 1. Product vision

The product is a shared workspace in which product managers, developers, architects, QA engineers, domain experts, and AI agents collaborate on one structured application specification.

The design document is not merely developer documentation. It is the shared source of truth through which people can:

- understand the application's exposed behaviors;
- discuss and refine requirements;
- connect product intent with domain and technical design;
- describe behavior using BDD scenarios;
- inspect scenario-specific sequences of building-block interactions _(deferred past the first iteration)_;
- ask agents to propose coherent changes;
- review and accept or reject those changes;
- prepare an agreed specification for implementation.

The experience should feel closer to editing together in Google Docs than to completing a large configuration form. The first iteration is a document, read top to bottom; the spatial, canvas-like presentation of the same model is a later iteration.

## 2. Core experience principles

### 2.1 One model, multiple lenses

> _Deferred._ The first iteration ships a single view that serves both audiences: one typed field
> list carries the business label and the field name and type together. The lens switch is designed
> in a later iteration, and the model must stay lens-ready — a lens is a presentation filter over the
> same elements, never a second document.

All participants work with the same underlying specification. The product must not create separate product and engineering documents that can drift apart.

The interface uses progressive disclosure and selectable lenses to adapt the presentation to the user's current task. The initial version has two lenses:

- **Product lens:** emphasizes actors, use cases, outcomes, acceptance scenarios, and business-facing details.
- **Technical lens:** reveals the application and domain building blocks, structured inputs and outputs, interaction flows, and implementation-facing details.

On a user's first visit, the Product lens opens by default. The application subsequently remembers that user's last-selected lens.

### 2.2 Behaviors before structure

> _Adjusted._ In the document view the entry point is the document itself: goal and business context
> first, then use cases in reading order under bounded context and application service. The table of
> contents plays the role the catalogue played; the visual map is deferred with section 8.

The primary entry point is a catalog and visual map of application behaviors, called **use cases**. Users should not initially face the entire domain model or a dense architecture graph.

The default hierarchy is:

> Bounded context → Application service → Use case

Use cases can additionally be filtered by actor, behavior type, and document-relevant status or completeness signals.

### 2.3 Calm by default

The system should show only the information needed to read the document. Detail that is not written yet is named once rather than printed as an empty section, change markers stay quieter than the content they annotate, and structural depth — building blocks, relationships — appears only when the reader asks for it.

The interface should not turn completeness into a scorecard or make Draft documents feel erroneous. Missing or inconsistent information is communicated through subtle hints.

### 2.4 Structured but document-like

The data remains typed and agent-readable, but users edit it through readable document sections and visual relationships. The experience should avoid exposing the schema as a conventional form wherever possible.

### 2.5 Proposals preserve trust

Agents do not silently mutate the accepted specification. Their changes enter as coherent proposals that humans accept or reject as a whole.

Human-authored decisions are preserved by default. An agent may challenge them in a proposal when necessary, but must clearly explain why.

### 2.6 Keep the codebase delta visible

> _Deferred in full to a future iteration (decision 52)._ Comparing the document against a
> source-code baseline — the Existing / New / Modified / Removed markers, the Deriving-Modified
> rule, and baseline refresh — is out of this iteration's requirements. The principle to preserve
> in the meantime: when the feature returns, a visible marker must mean "the source code must
> change here", derived from scanner-comparable fields only and never propagated upward through
> containment (decision 49).

## 3. Users and collaboration model

### 3.1 Primary participants

All of the following are primary collaborators rather than read-only audiences:

- product managers and product owners;
- software developers;
- architects and technical leads;
- QA engineers and testers;
- business and domain experts;
- AI agents.

### 3.2 Collaboration requirements

The intended experience includes:

- simultaneous document editing;
- live presence;
- collaborator cursors and selections;
- immediate synchronization of text changes;
- comments and mentions of people on model elements;
- resolvable comment threads;
- simultaneous canvas editing _(deferred with section 8)_.

Comments are a conversation between people. Agents are asked in the agent chat instead, so there is one rule for how agent output enters the document: what a user asks for in chat is applied, and work nobody asked for arrives as a proposal.

## 4. Expected document scale

The UX is optimized for:

- **Small documents (approximately 90%):** one or two bounded contexts, up to roughly 20 use cases, and up to roughly 30 building blocks.
- **Medium documents (approximately 10%):** three to eight bounded contexts, 20–100 use cases, and 30–150 building blocks.

The product should make small documents feel lightweight and direct. Medium documents should remain manageable through hierarchy, filtering, progressive disclosure, and selection-based relationship display. The initial UX does not need to behave like an enterprise architecture repository for thousands of elements.

The initial workspace targets laptop and desktop displays, approximately 1280 pixels wide and above. Tablet and mobile editing are outside the initial prototype scope.

Interaction is optimized for mouse, trackpad and keyboard text editing. Standard keyboard accessibility remains required for controls, navigation order, focus visibility, and core editing, but command palettes and comprehensive power-user shortcuts are not initial priorities.

## 5. Document lifecycle

The whole design document has only two lifecycle states:

- **Draft**
- **Implemented**

Individual use cases, building blocks, and scenarios do not have separate workflow states in the initial version.

While a document is Draft, the UI may show subtle hints for missing descriptions, actors, scenarios, or broken references. These hints do not block work and do not prevent the document from becoming Implemented.

## 6. Document creation and change proposals

### 6.1 Initial creation

The normal starting point is an agent-generated design document informed by an existing source-code scan. Humans and agents then refine the result collaboratively.

Blank manual authoring and import workflows are not the primary interaction to optimize first.

### 6.2 Source-code baseline

> _Deferred in full to a future iteration (decision 52)._ The scan-as-comparison-baseline, the
> newer-scan notification, and the explicit baseline refresh through a reconciled whole-document
> proposal all belong to the codebase-delta feature. Until it returns, a document is created and
> edited without reference to a scan.

### 6.3 Accepted document and pending proposal

The system distinguishes between:

1. the currently accepted specification; and
2. a pending coherent change proposal.

Agent changes do not enter the accepted document until a human explicitly accepts the proposal.

### 6.4 Review granularity

A proposal is reviewed, accepted, or rejected as a whole. Field-by-field and object-by-object acceptance are not required in the initial experience.

The proposal review should nevertheless explain its total impact clearly, including:

- added, changed, and removed objects;
- affected bounded contexts, application services, use cases, scenarios, and building blocks;
- changes that revise a human-authored decision;
- the agent's justification when it challenges such a decision.

### 6.5 Human-authored provenance

The current schema's field-level `*_locked` flags were originally intended to tell agents which values humans had deliberately changed.

The preferred product concept is provenance rather than literal locking:

- retain knowledge that a value or relationship was deliberately authored or changed by a human;
- instruct agents to preserve human decisions by default;
- allow an agent to propose a justified revision rather than making human content technically immutable;
- communicate authorship and proposal reasoning without filling the normal UI with lock icons.

The exact provenance data model remains to be designed.

## 7. Information architecture

### 7.1 Landing experience

> _Deferred._ The first iteration opens the document directly. A document list belongs to the
> application shell rather than to this feature, and the dashboard is designed once there is more
> than one document to orient between.

The landing experience combines:

- a lightweight dashboard; and
- the use-case catalog as its dominant content.

The dashboard should help users orient themselves without becoming a metrics-heavy administration screen. Likely supporting information includes document identity, Draft/Implemented status, recent activity or pending proposal state, and subtle completeness hints.

### 7.2 Use-case catalog

> _Adjusted._ The table of contents is the catalogue in the document view: bounded context →
> application service → use case, numbered, with the behaviour-type badge beside the name in the
> document. Filters by actor and behaviour type are deferred until a document is long enough to need
> them.

Use cases are organized by:

> Bounded context → Application service → Use case

Filters may provide alternate access by actor and behavior type:

- Command
- Query
- Event

A collapsed use-case entry is intentionally minimal and displays only:

- use-case name;
- Command, Query, or Event badge.

Actors and other metadata do not need to appear on every collapsed row.

### 7.3 Actors

An actor is a first-class element representing either:

- a human role; or
- an external system.

Actors have a many-to-many relationship with use cases. One actor can participate in multiple use cases, and one use case can involve multiple actors.

Actors are a section of the document in the first iteration, each with its kind and description; a use case names its actors in its own header line. Showing actors as canvas nodes is deferred with section 8.

### 7.4 Use-case ownership

A use case is a first-class, independently addressable object with exactly one owning application service.

This hybrid ownership enables a use case to:

- appear beneath its application service in the primary hierarchy;
- have a stable identity and direct link;
- own acceptance scenarios;
- participate in discussions and change history;
- reference actors and supporting building blocks;
- expose an interaction graph used by scenarios and sequence diagrams _(deferred with the Technical lens)_.

## 8. Main visual canvas

> _Deferred in full._ The first iteration has no canvas: no behaviour map, no selection-based
> relationship display, no contextual neighbourhood, no layout controls, and no graph editor.
> This section describes the later spatial iteration.

### 8.1 Default content

Before selection, the canvas shows:

- use cases;
- actors;
- their organizational grouping by bounded context and application service.

It does not show the complete set of aggregates, entities, value objects, repositories, factories, events, commands, queries, and integrations by default.

The default canvas is a behavior map, not a comprehensive architecture diagram.

### 8.2 Selection-based relationships

Relationships are hidden by default to prevent visual overload.

When a user selects an actor, use case, behavior, or building block, the canvas reveals or emphasizes only the connections relevant to that selection.

### 8.3 Codebase-relative visual state

> _Deferred with the codebase-delta feature (decision 52)._ When delta markers return, they must
> be distinguishable wherever model elements are browsed or edited, consistent across lenses,
> never colour alone, and quieter than the element name and behaviour type.

### 8.4 Contextual neighborhood

When a use case is selected, its supporting building blocks appear as a contextual neighborhood around it. Unrelated content stays quiet, fades, or remains hidden.

This local unfolding lets a user move from business behavior into architecture without switching immediately to a dense global graph.

### 8.5 Layout behavior

Canvas layout is hybrid:

- initial placement is automatic;
- users can manually reposition elements;
- intentional placement is preserved;
- a **Tidy up** action restores a readable automatic arrangement.

### 8.6 Synchronized editing

The behavior graph has two synchronized editing representations:

- a visual graph editor; and
- a structured interaction list.

Changes in either representation update the same underlying model.

## 9. Detail editing experience

> _Adjusted._ There is no side panel in the document view: the sections below are the document, in
> the same order, and every block is bound to one typed schema element. The rule that content is
> edited as readable prose rather than as a property inspector is unchanged.

Content is edited in place, in predictable typed sections rather than in a form of small controls.

### 9.1 Fixed sections

Content uses predictable, typed sections rather than freely ordered document blocks. A use case has exactly these sections, in this order:

| #   | Section                 | First iteration                            | Later, with the Technical lens |
| --- | ----------------------- | ------------------------------------------ | ------------------------------ |
| 1   | Summary                 | shown                                      | shown                          |
| 2   | Actors                  | shown, in the use-case header line         | shown                          |
| 3   | Description             | shown                                      | shown                          |
| 4   | Rules                   | shown                                      | shown                          |
| 5   | Input                   | one typed field list: label + `name: Type` | same list, technical wording   |
| 6   | Output                  | outcome sentence plus the same field list  | same list, technical wording   |
| 7   | Acceptance scenarios    | shown                                      | shown                          |
| 8   | Quality attributes      | shown                                      | shown                          |
| 9   | Related building blocks | deferred                                   | shown                          |
| 10  | Interaction flow        | deferred                                   | shown                          |
| 11  | Comments                | shown, in the threads sidebar              | shown                          |

Behavior type is not a section. It appears as the badge beside the use-case name, consistent with its treatment in the use-case catalog.

Three rules govern this list:

- A lens hides sections. It never reorders or renames them, so switching lenses cannot move a section the user was reading.
- A lens may hide only Related building blocks and Interaction flow. Every other section is shared, which is what makes the single-specification promise observable rather than merely asserted.
- An empty section is not shown as an empty box. The sections a use case has not yet been given are named once, quietly, at the end of that use case, so a thin Draft still reads as a document and nothing looks lost.

The sections must not be duplicated into separate documents.

### 9.2 Lens behavior

The Product lens prioritizes language and sections appropriate to product, domain, and QA discussion.

The Technical lens reveals the structural and interaction details required by developers and architects.

Changing lenses changes presentation and visibility, not the underlying data.

## 10. Building blocks and behaviors

The existing schema includes these building-block types:

- aggregate;
- entity;
- value object;
- domain event;
- domain command;
- domain query;
- domain service;
- application service;
- repository;
- factory;
- external integration.

Behaviors are especially important because they form the application and scenario interaction graph.

### 10.1 Application use cases

The behaviors exposed by application services are the application's primary use cases. A use case has one of three types:

- Command
- Query
- Event

### 10.2 Behavior graph

> _Deferred._ The behaviour graph feeds the interaction flow and sequence diagrams, both of which
> arrive with the Technical lens. The first iteration stores use cases, their fields, rules and
> scenarios without behaviour-to-behaviour relationships.

Behaviors link to other behaviors using a deliberately small relationship vocabulary:

- **invokes**
- **returns**
- **emits event**

The graph is structural and deterministic. It is not inferred from prose each time a diagram is displayed.

## 11. BDD scenarios

### 11.1 Two scenario levels

The model distinguishes:

- **Acceptance scenarios**, owned by use cases and intended for product/QA collaboration. These are in the first iteration.
- **Building-block behavioral scenarios**, owned by aggregates, services, integrations, or other relevant building blocks. _Deferred with the Technical lens._

### 11.2 Full Gherkin

Scenarios support the full expressive structure of Gherkin, including as applicable:

- Feature;
- Background;
- Scenario;
- Scenario Outline;
- Examples;
- Given, When, Then, And, and But steps;
- tags;
- comments.

Gherkin is used as a precise collaboration and specification language. In the initial version it is specification-only:

- no test runner integration;
- no step-definition management;
- no execution results;
- no requirement to round-trip with `.feature` files.

The exact editor interaction still needs to balance full Gherkin capability with accessibility for non-technical participants.

## 12. Scenario sequence diagrams

> _Deferred in full._ Sequence diagrams depend on the behaviour graph and scenario paths, and both
> arrive with the Technical lens. Nothing in the first iteration renders or edits them.

### 12.1 Source of truth

Sequence diagrams are model-driven projections, not separately authored drawings and not agent interpretations of prose.

The underlying behavior graph defines possible interactions between behaviors. Each acceptance scenario explicitly selects an ordered path through those behavior links.

The sequence for a scenario is therefore generated from:

1. the scenario's selected ordered path;
2. the referenced behaviors;
3. the building blocks that own those behaviors;
4. the active Product or Technical lens.

### 12.2 Lens-dependent detail

The same scenario path produces different levels of presentation:

- **Product lens:** business-level participants and outcomes.
- **Technical lens:** application services and supporting domain or infrastructure building blocks.

These are not separate diagrams. They are projections of the same accepted model.

### 12.3 Scenario path selection

When the behavior graph contains branches, a scenario explicitly identifies which links it exercises and in what order. The system does not infer this path from Gherkin text.

## 13. Comments and agent instructions

A comment attaches to a schema element and, within it, to the text it quotes. In the first iteration that covers everything the document shows: the document-level fields, actors, use cases and each of their sections, and scenario content. Building blocks, behaviours and behaviour-graph relationships become commentable when they become visible, with the Technical lens.

A comment may mention people. Comment threads are a human conversation: agents are asked in the agent chat instead, which keeps one rule for how agent output enters the document. Threads are resolved when the discussion is done.

## 14. Schema implications

The original `design-doc.ts` schema was a useful starting point, but several confirmed UX decisions required changes.

> **Built.** Every subsection below is now implemented in `packages/shared-contracts/src`, except 14.4 and 14.5, which stay deferred with the Technical lens. Decision 50 records the model, decision 51 the relationship between it and the editor, and `plan.md` section 3 the delivered shape. Each subsection ends with a note on how it was settled.

### 14.1 Make use cases first-class

`DesignedBehaviour` is currently nested in a building block. The target model needs a stable, independently addressable use-case entity with:

- an ID;
- one owning application-service reference;
- Command, Query, or Event type;
- many actor references;
- descriptions, rules, quality attributes, inputs, and outputs;
- acceptance-scenario references or ownership;
- behavior graph entry point;
- collaboration and provenance metadata.

The precise distinction between a use case and a lower-level building-block behavior should be explicit in the model.

> **Settled as two types that name each other.** `DesignedUseCase` is top-level and owned by an application service; `DesignedBehaviour` is top-level and owned by a building block, and is the node type of the graph in 14.4. A use case is not a behavior — it references actors, holds acceptance scenarios, and has a place in the document's reading order, none of which an interior behavior like `SlotHold.place()` has. The behavior that is a use case's entry point carries `useCaseId`, and the use case carries `behaviourId` back. There is no separate application-service record: an application service is a building block whose type is `application_service`, so a use case and its entry-point behavior resolve into one ID space.

### 14.2 Replace actor string with references

`DesignedBehaviour.actor: string | null` cannot represent the agreed many-to-many relationship. Use cases should reference actor IDs, and actors should have stable IDs.

> **Settled.** `DesignedUseCase.actorIds: string[]`, against actors with stable IDs.

### 14.3 Replace simple scenario fields with Gherkin structure

`DesignedScenario` currently contains one string each for `given`, `when`, and `then`. Full Gherkin requires a richer hierarchy for features, backgrounds, scenarios, outlines, examples, tags, comments, and ordered steps.

Acceptance scenarios and building-block behavioral scenarios should have explicit ownership semantics.

> **Settled as one shape, two owners.** `DesignedScenario` carries background, ordered steps, outline kind, examples table and tags. A use case's acceptance scenarios and a behavior's behavioral scenarios are the same structure — ownership is the distinction, not shape — with `DesignedAcceptanceScenario` as the use-case-owned alias. Background sits on the scenario rather than on its owner, because that is how the document renders it.

### 14.4 Add behavior relationships

> _Deferred with the Technical lens (10.2, 12)._

`usedBuildingBlocks: StringChangeSet` identifies a set but does not represent behavior-to-behavior connections or their order.

The schema needs stable behavior IDs and first-class relationship objects supporting:

- source behavior reference;
- target behavior reference;
- relationship type: invokes, returns, or emits event;
- optional display label or description;
- stable identity for comments and scenario references.

> **Still deferred, but the nodes exist.** `DesignedBehaviour` is modelled with stable IDs so the relationship objects have something to connect; nothing renders them yet.

### 14.5 Add scenario paths

> _Deferred with the Technical lens (12.3)._

An acceptance scenario needs an ordered set of behavior-relationship references. This path is the source for its generated sequence diagram.

> **Still deferred.** Scenario IDs are stable, so paths can be added later without re-anchoring anything.

### 14.6 Reconsider lock fields

The repeated `*_locked` booleans should be reconsidered in favor of provenance metadata and agent proposal policy. The UI should not imply that ordinary collaborators are prevented from editing unless access control is introduced as a separate requirement.

> **Settled as authorship.** Every `*_locked` boolean is gone. Prose carries `author: 'human' | 'agent'` — on rules, quality attributes, and a use case's description — which is what the quiet `person` tag renders and what tells the agent what it may rewrite unasked. Nothing in the model claims a collaborator is prevented from editing.

### 14.7 Separate current state from proposals

The existing `added`, `removed`, and `modified` change-set shape appears throughout the document tree. The clarified product requirement is that the accepted specification and the changes contained in a pending agent proposal are distinct: a pending proposal must not change what the accepted document says.

> **Settled as a normalized model.** Change sets are gone; the document is flat arrays related by ID. Proposal state is a separate object entirely — a whole-document `DesignDocProposal` held outside the specification. The codebase-relative dimension (Existing / New / Modified / Removed against a scanner baseline) is deferred with the codebase-delta feature (decision 52); when it returns it stays a dimension of its own, never collapsed into a proposal flag.

### 14.8 Add collaboration metadata outside core domain fields

Comments, mentions, presence, cursors, versions, and provenance are collaborative concerns. They should reference stable document/model IDs without forcing real-time session data into the portable domain specification itself.

> **Settled.** Comments, suggestions and proposals live in `design-doc-collaboration.ts`, keyed by document ID and anchored by an `ElementRef` — an element's ID alone, or `{ ownerId, path }` for a place that holds no element of its own, such as the goal text or a list as an insertion point. An anchor names what it points at and not where that thing sits, so it survives the element being renamed, reordered or moved to another parent. The quoted text travels with the anchor as evidence, not as the anchoring mechanism.
>
> Once the editor exists, the durable substring anchor is a mark carried in the shared Yjs document (decision 51); the portable specification carries plain text, so an export never leaks comment or suggestion state.

### 14.9 Track scanner origin and baseline comparison

> _Deferred in full to a future iteration (decision 52)._ Scanner identity, baseline snapshots,
> derived codebase-relative state, newer-scan notification and refresh reconciliation belong to
> the codebase-delta feature. Element IDs stay stable, so the metadata can be reintroduced
> without re-anchoring anything. What remains in the model now: a `DesignDocProposal` carries the
> whole proposed document, an impact summary with added / changed / removed / specification-only
> entries, and the human decisions it challenges, each with the agent's reasoning.

## 15. Prototype plan

> **Superseded.** The Stage 1 comparison ran and the document-view direction was chosen. The
> prototype lives in `prototypes/document-view.html`, the three compared concepts moved to
> `prior-art/stage1/`, and the implementation plan derived from the result is in `plan.md`. The
> sections below record what was compared and why.

Prototyping will follow a two-stage process.

### Stage 1: Low-fidelity comparison

Prepare three concepts using the same sample design document and identical core tasks. All three are built fresh against the model described in this specification. The earlier sketches in `prior-art/` predate it and are reference material only.

The comparison domain is an **appointment-booking system**. The sample should include human and external-system actors, bounded contexts for scheduling and notifications, application services, Command/Query/Event use cases, acceptance scenarios, supporting technical building blocks, and a mix of Existing, New, Modified, and Removed elements. Exact sample names may be refined during prototyping, but all three concepts must use the same dataset.

#### Prototype A: Persistent side panel

- Use-case catalog or map remains visible.
- Selecting an item opens its document-style details in a side panel.
- Optimizes continuity and quick comparison between nearby elements.

#### Prototype D: Preview then focused workspace

- Initial selection opens a compact preview.
- An explicit action opens a larger, focused use-case workspace.
- Tests whether separating browsing from deep work reduces intimidation.

#### Prototype E: Zoomable canvas

- Selection and navigation expand the chosen use case and contextual neighborhood directly on the canvas.
- Tests whether spatial continuity is more understandable than panels and page transitions.

### Stage 1 comparison tasks

Each concept should allow a reviewer to perform the same tasks:

1. Find a use case inside a bounded context and application service.
2. Identify its Command, Query, or Event type.
3. Select an actor and see related use cases.
4. Read and edit use-case details.
5. Switch between Product and Technical lenses.
6. Inspect acceptance scenarios.
7. open a scenario-specific sequence diagram.
8. Reveal the selected use case's supporting building-block neighborhood.
9. Add a comment mentioning a person or agent.
10. Understand that an agent proposal is pending and review its overall impact.

### Stage 1 evaluation criteria

Compare the three concepts on:

- ease of orientation for a first-time, non-technical user;
- speed of moving between use cases;
- ability to maintain visual context while reading details;
- comfort when editing substantial text;
- clarity of Product versus Technical lenses;
- discoverability of scenarios and sequence diagrams;
- amount of visual noise;
- suitability for real-time collaborative workshops;
- behavior at small and medium document sizes.

### Stage 2: Polished prototype

After comparing the low-fidelity concepts, select or combine the strongest interaction model and create a polished interactive prototype.

## 16. Confirmed constraints and non-goals for the initial version

### Confirmed constraints

- One shared structured specification serves all participant types.
- The specification is read and edited as one document, in a fixed order, with a table of contents.
- Every block in the document is bound to exactly one typed schema element. Content cannot be added, moved, or pasted in a way that produces untyped prose.
- Use cases are the default entry point, grouped bounded context → application service.
- Details are edited in fixed document-like sections. The use-case section list and its order are fixed; a lens may only hide sections.
- What a user asks the agent for in chat is applied to the document; agent work nobody asked for arrives as a whole-document proposal. Agents never author suggestions.
- Suggesting mode is the human review path, with accept and reject per suggestion.
- Comments address people; agents are asked in the agent chat.
- Full real-time document collaboration is the intended experience.
- Gherkin is specification-only.

### Deferred to a later iteration

- The codebase-delta feature: source-code baseline, Existing / New / Modified / Removed markers, scanner identity, and baseline refresh (decision 52).
- The Product/Technical lens switch, and with it Related building blocks and Interaction flow.
- The visual canvas: behaviour map, selection-based relationships, contextual neighbourhood, layout controls, graph editing.
- Sequence diagrams, the behaviour graph they project from, and scenario paths.
- Building-block behavioural scenarios.
- The dashboard landing experience and catalogue filters by actor and behaviour type.

### Initial non-goals

- Executing BDD scenarios or displaying test results.
- Supporting field-by-field proposal acceptance.
- Providing many specialized lenses.
- Showing the architecture graph at all in the first iteration.
- Optimizing first for extremely large enterprise models.
- Treating human-authored content as technically immutable.
- Agent mentions inside comment threads.
- Tablet and mobile editing in the initial prototype phase.

## 17. Open questions

Settled by the document-view prototype (details in `plan.md`, section 2): **1** navigation model,
**2** Gherkin presentation, **3** Input and Output wording, **4** proposal impact summary,
**6** provenance display, **9** change-marker treatment.

Still open for the first iteration:

5. What collaboration and versioning semantics apply when several humans edit while an agent proposal is pending?
6. What happens to a comment or suggestion whose anchored text is edited away — reanchor, orphan, or resolve? _Narrowed by the model: an anchor points at an element by ID, so editing the words inside a rule cannot detach a thread from it. Only the substring case is left, and it lands with the Yjs marks in phase 4._
7. How is a chat-applied change shown and undone, so "applied directly" does not read as "changed behind my back"? _Decision 51 supplies the mechanism — undo and version history belong to the Yjs document — but not the presentation._

Open, but only when their features arrive:

7. How should scenario paths be created and maintained efficiently alongside the behavior graph? _(with the Technical lens)_
8. Which building-block types appear in the contextual neighborhood for each lens? _(with the canvas)_

---

## 18. Working definition of success

A new participant should be able to open a small design document, read it from the goal down to the use cases without seeing the entire technical model, discuss and edit its structured details collaboratively, and inspect its acceptance scenarios. Moving further into technical depth — building blocks, interaction flow, sequences — arrives with the Technical lens.

Product and engineering participants should leave a review or workshop believing they edited the same specification rather than two synchronized interpretations of it.
