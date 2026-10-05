# Modelling guidance

How to turn source material into modules, building blocks, behaviours,
rules and scenarios. The design document contract says how to write them
down; this says how to choose them.

## Definitions

A module, a building block and a behaviour each have a `definition`: what
the concept is, in the language of the domain, as an entry in the system's
glossary. A sentence or two a reader who knows no code understands. It
defines the concept, never the change to it and never how it is built, so
it stays true once the change ships.

## Needs

- A need is a stakeholder goal, not a solution: what someone must be able
  to do or have, never how the system does it. "Start a QDoc", not "Create
  QDoc endpoint".
- Name it as a goal, a verb phrase in the stakeholder's terms. Its
  `stakeholder` is who has it, as the sources name them ("Quality
  managers"). Its `statement` says who needs what, and when or why it
  matters: "The quality managers need to start a QDoc when a process needs
  documenting, so that its preparation can begin."
- One need per distinct goal. Two goals in one sentence of a source are two
  needs; one goal said twice is one.
- Its `id` is its name in lower-case kebab-case (`start-a-qdoc`), unique in
  the design document.
- A need comes from a source. Never invent one to justify a rule.

## Modules

- Modules form a hierarchy. A root module is a bounded context; the modules
  below it are its domain modules.
- A module is named for a domain concept — a business capability or
  responsibility shared by its building blocks. Never for a technical
  division: no `entities`, `repositories`, `api`, `application` or
  `infrastructure` modules.
- Create a module when several building blocks are strongly connected to
  each other or focused on one domain concept.
- Place a new module under the existing module that models the closest
  domain concept with a broader scope. What is near in the domain is near
  in the model.
- The scanner derives modules from the code's packages or namespaces, so a
  new module is a new package or namespace.
- Never create a root module without the user's approval.

## Building block types

Use the type the system model reports for a building block that exists.
For a new one:

- `aggregate`: a cluster of entities and value objects changed as one unit.
  Its root enforces the invariants; others refer to the root only; keep it
  small.
- `entity`: identity-centric, with a lifecycle spanning many state changes.
  Equal by identity; its behaviours change state and guard invariants.
- `value_object`: a concept without identity. Immutable, validated on
  creation, rich in meaning (calculations, formatting) rather than a bag of
  primitives. Messages are value objects too: an event records something
  meaningful that happened, is named in the past tense and carries the
  minimum its subscribers need; a command is a request to change the
  domain, named in the imperative; a query is a request to read it.
- `domain_service`: a stateless operation that fits no entity or value
  object. Takes and returns domain concepts; owns no state.
- `application_service`: orchestrates use cases — calls aggregates, domain
  services and repositories, handles transactions, security and
  integration, and leaves domain rules to the domain.
- `repository`: a collection-like interface for storing and loading
  aggregates, whole. Methods say intent (`findActiveOrdersFor`).
- `factory`: creation too complex for a constructor. Returns fully valid
  objects.
- `external_integration`: a port to another system, or the adapter that
  implements one.

### Interchangeable building blocks

When a property, a collection's elements or a behaviour's input or output
can be any of two or more building blocks, model the abstraction they share
as a base building block. Each of them lists the base in `implements`, and
the reference names the base. The base is a real domain concept (a
`Component` over `CompositeComponent` and `SimpleComponent`), never an
umbrella invented to satisfy a reference.

### Tables in the sources

Decide what a table stands for before modelling its rows:

- Each row has behaviour or invariants of its own: each row is a building
  block.
- The rows describe one element: each row is a property of it.
- The rows are data the system reads or writes at run time: not building
  blocks. At most, the configuration of one building block.

## Behaviours

- `Command` changes state, `Query` reads it, `Event` reacts to something
  that happened.
- A use case is a public behaviour: an action triggered from outside its
  module by a command, event or query. Group cohesive use cases as the
  behaviours of one `application_service`; do not give every use case a
  service of its own.
- Everything else is private.
- Inputs and outputs are building blocks or primitives. Prefer the value
  object that gives a primitive its meaning (`Money`, not `decimal`) when
  the model has one.
- An input has the name the behaviour takes it under (`reason`, not
  `string`), a description and whether it may be left out. An output has
  no name: it is its type, a description and whether it may be absent.
- A behaviour's `definition` says what it does for the domain, as any
  [definition](#definitions) does. What an implementer needs beyond that has
  a field of its own: what goes in and out in the descriptions of the input
  and output, preconditions in rules, edge cases in scenarios, and the steps,
  when they matter, in the diagram.
- A module, a building block and a behaviour each have a `diagram` field:
  the source of one Mermaid diagram, without the ` ```mermaid ` fence.
  Never put a diagram in a `definition`; the service refuses a fence there.
  Leave `diagram` out when there is nothing to draw: it is the one field an
  added element may leave out.
- When a behaviour coordinates three or more building blocks, or is the
  entry point of a use case, give it a sequence diagram, adapted from the
  sources when they have one. Name it with `accTitle:`, the only text a
  screen reader reads in place of the picture:

  ```json
  "diagram": {
    "value": "sequenceDiagram\n  accTitle: Issuing a refund\n  Support agent->>RefundService: issue(orderId, lines)\n  RefundService->>OrderRepository: find(orderId)\n  RefundService->>Refund: issue(order, lines)\n  Refund-->>RefundService: RefundIssued"
  }
  ```

- Give every aggregate an entity diagram (`erDiagram`): its root and each
  entity and value object it holds, with their properties and the
  cardinalities the rules set. Name it with `accTitle:` too:

  ```json
  "diagram": {
    "value": "erDiagram\n  accTitle: Entities of the Order aggregate\n  Order {\n    OrderId id PK\n    OrderStatus status\n  }\n  OrderLine {\n    ProductId product\n    integer quantity\n  }\n  Order ||--|{ OrderLine : \"has lines\""
  }
  ```

- Draw any other building block or a module only when a picture says more
  than its definition: the states of an entity (`stateDiagram-v2`), the
  collaborators of a module (`flowchart`).

## Actors

- An actor is always a human persona or role: _Customer_, _Warehouse
  operator_, _Approving manager_.
- Never another system, another module, a scheduler or a technical layer.
  A behaviour such a trigger starts is public with no actors, reached by a
  command or an event.
- Reuse the actor names the system model already uses, verbatim. Introduce
  a new name only when no existing persona fits.

## Rules

A rule states one requirement. Name it as a sentence that states the rule
("Refund never exceeds paid amount"). Its `description` is the requirement
statement: what holds, not why the name is true. Its scenarios verify it.

- One rule per requirement statement. Never merge two statements of a
  source into one rule, even when they read alike.
- `needs` names the ids of the needs the rule answers. A rule no need asks
  for is a design decision: write `needs: []`, and name it in the report.
- `rationale` says why the rule holds, when a source gives a reason. Leave
  it out rather than invent one. It never says why the rule changed: that
  goes in the design document's `description`.
- A rule is one of three categories, and its `ruleType` is a type of that
  category.

### Business rules

A truth of the domain: an invariant, a computation, a guard on a
transition. On a building block or a behaviour, never on a module.

| Pattern                                                                                                                   | Quick check                                                                  | `ruleType`     |
| ------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------- | -------------- |
| Structural contract: the fields and formats an element must have (`Address` needs street, city, postal code and country)  | Does it make malformed instances impossible?                                 | `Structure`    |
| Validation: a semantic invariant on state (departure differs from arrival, stock never negative, intervals never overlap) | Can a violation be seen from the element's own data?                         | `Consistency`  |
| Calculation: a deterministic formula (prorated fee = price × remaining days ÷ period days)                                | Is it a pure function where units, precision and rounding matter?            | `Computation`  |
| Categorisation: conditions mapped to one outcome of a finite set (risk tier, shipping method)                             | Does it pick a named outcome by thresholds the business changes?             | `Computation`  |
| State change: a guard allowing or forbidding one operation (no seat change after check-in)                                | Does it gate a single transition that would otherwise produce a valid state? | `State change` |
| Process flow: routing or ending a multi-step process (refunds over €1,000 go to a manager)                                | Does it pick the next step, or stop, across several steps or services?       | `State change` |

A guard on who may do an operation ("Only quality managers create QDocs")
is a business rule, `State change`, on the behaviour it guards.

### Quality rules

A measurable quality the system must have. State the measure and its
bound ("answers within one second for an order of up to 100 lines"); when
a source leaves the bound open, say so and name the open question. Types
follow ISO/IEC 25010:

| `ruleType`        | The system must…                                                                      |
| ----------------- | ------------------------------------------------------------------------------------- |
| `Performance`     | answer, process or deliver within a time, a throughput or a resource budget           |
| `Security`        | protect itself and its data: authentication, encryption, audit, confidentiality       |
| `Reliability`     | keep working and recover: availability, fault tolerance, no partial failure spreading |
| `Usability`       | be learnable and operable by its users, accessibility included                        |
| `Compatibility`   | coexist and exchange data with other systems                                          |
| `Maintainability` | be changed, tested and analysed at a bounded cost                                     |
| `Portability`     | be installed on and moved between the environments it must run in                     |

`Security` is how the system protects itself; who may do what is a
business rule.

### Constraint rules

A limit imposed on the solution from outside the domain, which the design
does not choose:

| `ruleType`     | The solution must…                                                            |
| -------------- | ----------------------------------------------------------------------------- |
| `Technology`   | use, or avoid, a given platform, language, library or product                 |
| `Regulation`   | comply with a law, a standard or a contract                                   |
| `Interface`    | talk to another system through a protocol, format or endpoint it does not own |
| `Organisation` | fit how the organisation works: its teams, processes, budget or schedule      |

### Where a rule goes

- Attach a rule at exactly one level, never two.
- A business rule goes on the building block when it constrains the
  block's shape or holds for all its behaviours; on the behaviour when it
  gates that one behaviour.
- A quality or constraint rule goes on the narrowest element it
  constrains: a module, a building block or a behaviour. One on a part (a
  timeout on an output, a format of a property) goes on the element that
  owns the part.

## Scenarios

- One scenario checks one behaviour of the domain, in given, when and then,
  in business language, with assertions a test can check. Cover the edge
  cases and error conditions, not only the happy path.
- Attach it to the rule it verifies; else to the behaviour, when it spans
  the use case; else to the building block, when it spans several of its
  behaviours.
- A scenario that verifies no known rule usually exposes a missing rule.

Example, attached to the rule "Cancellation after the minimum period only":

- given: a subscription with a three-month minimum commitment, one month
  after it started
- when: the user cancels the subscription
- then: the cancellation is rejected and the remaining commitment period is
  shown
