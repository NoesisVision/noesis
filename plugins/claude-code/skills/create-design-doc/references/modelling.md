# Modelling guidance

How to turn source material into modules, building blocks, behaviors,
rules and scenarios. The design document contract says how to write them
down; this says how to choose them.

## Definitions

A module, a building block and a behavior each have a `definition`: what
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
- So does its stakeholder. When the sources name nobody who has the goal,
  leave `stakeholder` empty (`""`) and write the `statement` without a
  subject, in the sources' words: "Grant a 10% discount while it rains",
  never "The shop needs to…". Do not infer a stakeholder from the domain.

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
  Equal by identity; its behaviors change state and guard invariants.
- `value_object`: a concept without identity. Immutable, validated on
  creation, rich in meaning (calculations, formatting) rather than a bag of
  primitives.
- `command`: a message asking to change the domain, named in the
  imperative (`CreateQDoc`).
- `query`: a message asking to read it (`FindOpenOrders`).
- `event`: a message recording something meaningful that happened, named
  in the past tense and carrying the minimum its subscribers need
  (`QDocCreated`).
- `domain_service`: a stateless operation that fits no entity or value
  object. Takes and returns domain concepts; owns no state.
- `application_service`: orchestrates use cases — calls aggregates, domain
  services and repositories, handles transactions, security and
  integration, and leaves domain rules to the domain.
- `repository`: a collection-like interface for storing and loading
  aggregates, whole. Methods say intent (`findActiveOrdersFor`).
- `factory`: creation too complex for a constructor. Returns fully valid
  objects.
- `external_integration`: a port to another system.
- `in_adapter`: what drives the system from outside — a controller, a
  listener, a scheduled job — and calls its application services.
- `out_adapter`: what the system drives something outside through — the
  implementation behind a repository or an external integration.
- `technical_service`: a technical capability the domain does not name —
  a clock, an id generator, a mailer's transport.

### State and collaborators

What a block holds is one of two relations, decided by the kind of the
block it points at, never by how the code spells it:

- `has_state`: a primitive, or a block that is a value of the domain — an
  `aggregate`, `entity`, `value_object`, `command`, `query` or `event` —
  with a `cardinality`.
- `has_collaborator`: a block it works with — any other kind: a
  repository, a service, a factory, an integration, an adapter — by the
  name it holds it under, with no cardinality. A service's collaborators
  are usually what its constructor is handed.

The service refuses a `has_state` to a collaborator kind and a
`has_collaborator` to a value of the domain (`slotOutsideTypeKind`).

### Interchangeable building blocks

When a piece of state or a behavior's input or output can be any of two or
more building blocks, model the abstraction they share as a base building
block. Each of them `extends` the base (a relation from it to the base),
and the slot's `to` names the base. The base is a real domain concept (a
`Component` over `CompositeComponent` and `SimpleComponent`), never an
umbrella invented to satisfy a reference.

### Tables in the sources

Decide what a table stands for before modelling its rows:

- Each row has behavior or invariants of its own: each row is a building
  block.
- The rows describe one element: each row is a property of it.
- The rows are data the system reads or writes at run time: not building
  blocks. At most, the configuration of one building block.

## Behaviors

- A behavior has no type of its own: what kind of message it handles is
  the kind of the block it takes (`has_input` a `command`, a `query` or an
  `event`).
- A use case is a behavior that drives its module: an action triggered
  from outside it by a manual process, a command, an event or a query.
  Group cohesive use cases as the behaviors of one `application_service`
  (or of an `in_adapter`, when the design shows the edge that receives
  them); do not give every use case a service of its own.
- A behavior says nothing of who may call it: the `invokes` relations that
  end at it do.
- Inputs and outputs are building blocks or primitives. Prefer the value
  object that gives a primitive its meaning (`Money`, not `decimal`) when
  the model has one.
- An input is a `has_input` relation from the behavior: the name the
  behavior takes it under (`reason`, not `string`), its type in `to`,
  how many it holds in `cardinality` (`1`, `0..1` when it may be left out,
  `0..*` or `1..*` for a collection) and its `position` in the signature,
  counting from 1. An output is a `has_output` relation:
  no name, its type in `to` and its cardinality. A block's state is a
  `has_state` relation the same way. What a slot means is the definition
  of the block it points at; a relation carries no description.
- A behavior's `definition` says what it does for the domain, as any
  [definition](#definitions) does. What an implementer needs beyond that has
  a field of its own: preconditions in rules, edge cases in scenarios, and
  the steps, when they matter, in the diagram.
- A module, a building block and a behavior each have a `diagram` field:
  the source of one Mermaid diagram, without the ` ```mermaid ` fence.
  Never put a diagram in a `definition`; the service refuses a fence there.
  Leave `diagram` out when there is nothing to draw: it is the one field an
  added element may leave out.
- When a behavior coordinates three or more building blocks, or is the
  entry point of a use case, give it a sequence diagram, adapted from the
  sources when they have one. Name it with `accTitle:`, the only text a
  screen reader reads in place of the picture:

  ```json
  "diagram": {
    "value": "sequenceDiagram\n  accTitle: Issuing a refund\n  Support agent->>RefundService: issue(orderId, lines)\n  RefundService->>OrderRepository: find(orderId)\n  RefundService->>Refund: issue(order, lines)\n  Refund-->>RefundService: RefundIssued"
  }
  ```

- Give every aggregate an entity diagram (`erDiagram`): its root and each
  entity and value object it holds, with their state and the
  cardinalities the rules set. Name it with `accTitle:` too:

  ```json
  "diagram": {
    "value": "erDiagram\n  accTitle: Entities of the Order aggregate\n  Order {\n    OrderId id PK\n    OrderStatus status\n  }\n  OrderLine {\n    ProductId product\n    integer quantity\n  }\n  Order ||--|{ OrderLine : \"has lines\""
  }
  ```

- Draw any other building block or a module only when a picture says more
  than its definition: the states of an entity (`stateDiagram-v2`), the
  collaborators of a module (`flowchart`).

## Actors and manual processes

Who drives the system is not said on a behavior. A person does some work by
hand — a manual process — and that work calls the system's behaviors.

- An actor is always a human persona or role: _Customer_, _Warehouse
  operator_, _Approving manager_. Its id is its name alone:
  `actor|Warehouse operator`.
- Never another system, another module, a scheduler or a technical layer.
  A behavior such a trigger starts is invoked by no manual process,
  reached by a command or an event.
- Reuse the actor names the system model already uses, verbatim. Introduce
  a new name only when no existing persona fits.
- A manual process is one goal an actor reaches, named as the work:
  `manual_process|Refund a returned order`. Its `invokes` relations are the
  behaviors it calls, `order` counting from 1 in the order the actor calls
  them; a `performs` relation joins each actor who does it. A process that
  calls a single behavior is fine.
- A process invokes the behaviors that drive the system: those of
  application services and in adapters, never an aggregate's or a
  repository's.
- No scan finds a manual process: a design adds every one it needs, even
  one an earlier design added.

```json
{ "kind": "performs", "from": "actor|Support agent", "to": "manual_process|Refund a returned order" },
{ "kind": "invokes", "from": "manual_process|Refund a returned order", "to": "behavior|sales.refunds.RefundService.issue", "order": { "value": 1 } }
```

## Deployable units and libraries

What the code ships as. The scan makes one of each build artifact that
declares a building block: an executable one (a service, a runnable JAR, an
executable assembly) is a deployable unit, any other a library.

- Each is named as the build names it, dots and all: `deployable_unit|shop-api`,
  `library|MyCompany.Sales.DeepModel`. Reuse the names in the system model
  verbatim.
- A deployable unit `contains` modules; a library `contains` building
  blocks. The service refuses any other pair (`containmentOutsideKinds`).
- Add one only when the design changes what ships: a new service or a new
  shared package. A new module or block that ships in an existing unit or
  library gets a `contains` from it; otherwise leave packaging alone.

```json
{ "kind": "contains", "from": "deployable_unit|shop-api", "to": "module|sales.refunds" },
{ "kind": "contains", "from": "library|MyCompany.Sales", "to": "building_block|sales.refunds.Refund" }
```

## Layers and deployment containers

How the code is sliced, and where it runs.

- A layer (`layer|domain`, `layer|application`) is named by a `@Layer`
  annotation on a package's `package-info.java`; a block is in the layer of
  the nearest annotated package above it. A layer `contains` building blocks
  only. Reuse the layer names the system model has, verbatim; add a layer,
  or a `contains` from one, only when the design changes the layering. A
  codebase without the annotation has no layers: leave them out.
- A deployment container (`deployment_container|Shop cluster`) is where
  deployable units run: a cluster, a server, a serverless platform. No scan
  finds one; author it when the design says where a unit runs, with a
  `hosts` relation to each unit it runs.

```json
{ "kind": "contains", "from": "layer|domain", "to": "building_block|sales.refunds.Refund" },
{ "kind": "hosts", "from": "deployment_container|Shop cluster", "to": "deployable_unit|shop-api" }
```

## Rules

A rule states one requirement a behavior follows. It is an element of its
own, in `rules`, and becomes a `Rule:` of a Gherkin feature file: its name
the `Rule:` line, its `description` the text under it, its `kind` the tag
on it. Name it as a sentence that states the rule ("Refund never exceeds
paid amount"). Its `description` is the requirement statement: what holds,
not why the name is true. Its scenarios illustrate it.

- One rule per requirement statement. Never merge two statements of a
  source into one rule, even when they read alike.
- `needs` names the ids of the needs the rule answers. A rule no need asks
  for is a design decision: write `needs: []`, and name it in the report.
- `rationale` says why the rule holds, when a source gives a reason. Leave
  it out rather than invent one. It never says why the rule changed: that
  goes in the design document's `description`.
- `kind` is the rule's only classification, one of the six below.

### Rule kinds

| `kind`          | The rule…                                                                        | Quick check                                                                      | Examples                                                                                 |
| --------------- | -------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| `validation`    | accepts or rejects input before anything changes                                 | Is a request refused while the state stays as it was?                            | An address has street, city, postal code and country; only quality managers create QDocs |
| `state_change`  | says how state moves from one value to the next: which transitions are allowed   | Does it allow or forbid one transition of the state?                             | No seat change after check-in; only a paid order can be refunded                         |
| `post`          | must hold, or happen, after a behavior completes: a postcondition or a follow-up | Is it checked on what the behavior left behind or set off?                       | A created QDoc is announced; an issued refund is recorded against its order lines        |
| `computation`   | derives a value from others                                                      | Is it a function of its inputs, where units, precision and rounding matter?      | Prorated fee = price × remaining days ÷ period days; the risk tier of a customer         |
| `coordination`  | orders or ties together work across behaviors or building blocks                 | Does it pick the next step, or make several steps happen together or not at all? | Refunds over €1,000 go to a manager; an order is saved and announced together            |
| `configuration` | is set by a setting rather than fixed in code: a limit, a threshold, a switch    | Would the business change its value without changing the code?                   | At most as many open orders per customer as the market allows; rain discounts on or off  |

Pick the kind by what the rule does when its behavior runs, not by what
it is about:

- An invariant of a block's state (departure differs from arrival, stock
  never negative, intervals never overlap) is a `validation` when the
  behaviors that could break it refuse the input that would, a `post` when
  it is what a behavior's result must satisfy.
- A guard on who may do an operation is a `validation` of the behavior it
  guards: the request is refused before anything changes.
- A categorisation (conditions mapped to one outcome of a finite set: a
  risk tier, a shipping method) is a `computation`.
- A bound the sources fix ("at most 10 lines") is the kind of what the rule
  does with it, usually `validation`. It is `configuration` only when the
  sources say a setting holds it: per tenant, per market, changed by an
  operator.
- When two kinds fit, the rule usually states two requirements: split it
  into two rules.

### Requirements that are no rules

A quality the system must have (performance, security, reliability,
usability, compatibility, maintainability, portability) or a constraint
imposed on the solution (a technology, a regulation, an interface to
another system, how the organisation works) is a rule of the model only
when a behavior follows it in a way a scenario can show. Then it takes the
kind that fits:

- a limit a setting holds — a timeout, a retry count, a rate an operator
  sets — is `configuration`, governed by the behavior it limits;
- something that must hold or happen after a behavior — an audit entry for
  every refund, a notice to the other system — is `post`.

Any other — a response time, an availability, a platform, a law to comply
with — is no rule: leave it to the change's documents. When a source
states it as a stakeholder's goal, it is a need, and the report names it
among the needs no rule answers; otherwise name it in the report as left to
the documents. Never force it into a kind.

### Which behavior governs a rule

- Rules attach only to behaviors, never to a module or a building block. A
  `governs` relation, from a behavior to the rule, joins a rule to each
  behavior that follows it. An added rule needs at least one; the service
  refuses one without (`ungovernedRule`).
- The behavior that governs a rule is the one a scenario's `when` calls to
  see the rule hold: the behavior that refuses the input, makes the
  transition, computes the value or coordinates the work. For a rule the
  use case shows, that is usually the use case's behavior, on the
  application service or the in adapter; for a rule the domain holds on its
  own, the behavior of the aggregate, entity, value object or domain
  service that decides it, when a scenario can call it directly.
- A rule several behaviors must keep (an invariant every behavior that
  changes the block keeps) is one rule governed by each of them, never one
  copy per behavior.
- Its id is `rule|`, the path of the module of the behavior that governs
  it, then its name: `rule|sales.refunds.Refund never exceeds paid amount`
  for a rule `behavior|sales.refunds.Refund.issue` governs. When behaviors
  of several modules govern it, the module is that of the behavior its
  first scenario's `when` calls.

## Scenarios

- A scenario is a concrete example of one rule. It is an element of its
  own, in `scenarios`, joined to the rule by an `illustrates` relation from
  the scenario to the rule, and becomes a `Scenario:` under the rule's
  `Rule:` in a feature file, run as a test with Cucumber or Reqnroll. Write
  it as that test.
- Its id is under its rule: `scenario|`, the rule's path, then its name, as
  in the example below. Its `illustrates` names the rule its id is under;
  the service refuses any other (`containmentOutsideIdPath`).
- Every rule gets at least one scenario: the scanner finds a rule only
  through a scenario whose `when` calls the behavior that governs it, so a
  rule without one never comes back from the scan.
- A scenario that illustrates no rule exposes a missing rule: add the rule.
- One scenario checks one case of its rule, in business language, with
  assertions a test can check. Cover the edge cases and error conditions,
  not only the happy path.
- Its `steps` are the Gherkin steps it becomes, in reading order, each a
  `kind` (`given`, `when` or `then`) and its `text`: the step's line
  without its keyword. Consecutive steps of one kind become `And` steps.
  Write one step per fact: two preconditions are two `given` steps, not one
  joined with "and". Any kind may repeat or be left out, but a scenario has
  at least one step.
- `given` sets the starting state, `then` states the outcome.
- `when` describes the call of the behavior that governs the rule, as the
  actor or trigger makes it: "the support agent refunds the first line", not
  "refund is issued". Keep to one `when`; when there are several, they
  call that one behavior between them, never another one beside it.
- Word one action the same way in every scenario that takes it ("the
  customer places the order"), so one step definition binds them all.

Example, illustrating the rule "Cancellation after the minimum period
only", which `behavior|billing.subscriptions.Subscription.cancel` governs:

```json
{
  "id": "scenario|billing.subscriptions.Cancellation after the minimum period only.Cancelling within the minimum period",
  "name": { "value": "Cancelling within the minimum period" },
  "description": {
    "value": "A cancellation before the commitment ends is refused."
  },
  "steps": {
    "value": [
      {
        "kind": "given",
        "text": "a subscription with a three-month minimum commitment"
      },
      { "kind": "given", "text": "one month has passed since it started" },
      { "kind": "when", "text": "the user cancels the subscription" },
      { "kind": "then", "text": "the cancellation is rejected" },
      { "kind": "then", "text": "the remaining commitment period is shown" }
    ]
  }
}
```

with its relations:

```json
{ "kind": "governs", "from": "behavior|billing.subscriptions.Subscription.cancel", "to": "rule|billing.subscriptions.Cancellation after the minimum period only" },
{ "kind": "illustrates", "from": "scenario|billing.subscriptions.Cancellation after the minimum period only.Cancelling within the minimum period", "to": "rule|billing.subscriptions.Cancellation after the minimum period only" }
```

It becomes, in the feature file:

```gherkin
@state_change
Rule: Cancellation after the minimum period only
  A subscription is cancelled only once its minimum commitment has passed.

  Scenario: Cancelling within the minimum period
    Given a subscription with a three-month minimum commitment
    And one month has passed since it started
    When the user cancels the subscription
    Then the cancellation is rejected
    And the remaining commitment period is shown
```
