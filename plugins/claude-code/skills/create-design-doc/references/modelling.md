# Modelling guidance

How to turn source material into modules, building blocks, behaviours,
rules and scenarios. The design document contract says how to write them
down; this says how to choose them.

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
  primitives.
- `domain_event`: an immutable record of something meaningful that
  happened. Named in the past tense; carries the minimum its subscribers
  need.
- `domain_command`: a request to change the domain, named in the
  imperative.
- `domain_query`: a request to read the domain.
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
- The description tells an implementer what to build: the input, the
  preconditions, the steps, the output and the edge cases.
- When a behaviour coordinates three or more building blocks, or is the
  entry point of a use case, end its description with a Mermaid sequence
  diagram, adapted from the sources when they have one:

  ````
  ```mermaid
  sequenceDiagram
    Support agent->>RefundService: issue(orderId, lines)
    RefundService->>OrderRepository: find(orderId)
    RefundService->>Refund: issue(order, lines)
    Refund-->>RefundService: RefundIssued
  ```
  ````

## Actors

- An actor is always a human persona or role: _Customer_, _Warehouse
  operator_, _Approving manager_.
- Never another system, another module, a scheduler or a technical layer.
  A behaviour such a trigger starts is public with no actors, reached by a
  command or an event.
- Reuse the actor names the system model already uses, verbatim. Introduce
  a new name only when no existing persona fits.

## Rules

A rule is a domain truth: an invariant, a computation, a guard on a
transition. Name it as a sentence that states the rule ("Refund never
exceeds paid amount"). Its description says what holds, not why the name is
true.

| Pattern                                                                                                                   | Quick check                                                                  | `ruleType`     |
| ------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------- | -------------- |
| Structural contract: the fields and formats an element must have (`Address` needs street, city, postal code and country)  | Does it make malformed instances impossible?                                 | `Structure`    |
| Validation: a semantic invariant on state (departure differs from arrival, stock never negative, intervals never overlap) | Can a violation be seen from the element's own data?                         | `Consistency`  |
| Calculation: a deterministic formula (prorated fee = price × remaining days ÷ period days)                                | Is it a pure function where units, precision and rounding matter?            | `Computation`  |
| Categorisation: conditions mapped to one outcome of a finite set (risk tier, shipping method)                             | Does it pick a named outcome by thresholds the business changes?             | `Computation`  |
| State change: a guard allowing or forbidding one operation (no seat change after check-in)                                | Does it gate a single transition that would otherwise produce a valid state? | `State change` |
| Process flow: routing or ending a multi-step process (refunds over €1,000 go to a manager)                                | Does it pick the next step, or stop, across several steps or services?       | `State change` |

- Attach a rule at exactly one level. The building block when it
  constrains the block's shape or holds for all its behaviours; the
  behaviour when it gates that one behaviour. Never both.
- A technical constraint — a latency target, availability, authentication,
  a timeout, a retry policy — is not a rule. State it in the description of
  the narrowest element it constrains.

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
