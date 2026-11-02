# The new system model structure

This note describes the system model metamodel drawn in [`docs/img.png`](../img.png):
which element types the model has, how they relate, and which kinds each
abstract type (Building Block, Primitive, Rule) comes in. The last
section lists what changes against the current contract,
`plugins/claude-code/contracts/system-model.schema.json`.

Building Block, Primitive and Rule are abstract: a model never holds a bare
Building Block, only one of its kinds.

## 1. Notation used in the diagram

| Look                        | Meaning                                                                                                                                                                    |
| --------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Orange box                  | Core element of the model.                                                                                                                                                 |
| Blue box                    | Deployment element (where code runs).                                                                                                                                      |
| Green dashed border         | Element that does not come from the code structure itself (deployment, people, manual work). These are expected to be added by hand or from other sources than the parser. |
| Label in `[...]` on an edge | Attributes the relation carries, e.g. `[name, cardinality]`, `[order]`.                                                                                                    |

## 2. Elements

### Structure and grouping

- **Module** — a unit of code ownership, usually a package or namespace.
  Modules nest: a module contains other modules.
- **Layer** — a horizontal slice of the architecture (for example domain,
  application, infrastructure). It groups building blocks across modules. A
  building block belongs to at most one layer.
- **Library** — a reusable package of building blocks that the system depends
  on or ships.

### Deployment

- **Deployable Unit** — something built and shipped as one piece (a service, a
  JAR, an assembly). It contains modules.
- **Deployment Container** — the runtime that hosts deployable units (a
  container, a pod, an app server, a function runtime).

### Core

- **Building Block** — a named type in the code that plays a tactical role
  (aggregate, repository, adapter, …). See section 4.1 for the kinds.
- **Behavior** — an operation a building block exposes: a method, a handler,
  an endpoint.
- **Primitive** — a built-in value type used for state and parameters. See
  section 4.2.
- **Rule** — a rule the system follows. A rule is attached only to
  behaviors, never to a module or a building block. See section 4.3 for the
  kinds.
- **Scenario** — a concrete example (given / when / then) that illustrates a
  rule.

### People and manual work

- **Actor** — a person or role outside the code.
- **Manual Process** — work an actor performs that is not automated; it calls
  behaviors of the system in a given order.

## 3. Relations

| From                 | Relation         | To              | Attributes        | Notes                                                                                               |
| -------------------- | ---------------- | --------------- | ----------------- | --------------------------------------------------------------------------------------------------- |
| Deployment Container | hosts            | Deployable Unit |                   |                                                                                                     |
| Deployable Unit      | contains         | Module          |                   |                                                                                                     |
| Module               | contains         | Module          |                   | Nesting of modules.                                                                                 |
| Module               | contains         | Building Block  |                   |                                                                                                     |
| Layer                | contains         | Building Block  |                   | A building block is in at most one layer.                                                           |
| Library              | contains         | Building Block  |                   |                                                                                                     |
| Building Block       | extends          | Building Block  |                   | Inheritance or interface implementation.                                                            |
| Building Block       | has state        | Building Block  | name, cardinality | A field whose type is another building block (e.g. an aggregate holding entities or value objects). |
| Building Block       | has state        | Primitive       | name, cardinality | A field of a built-in type.                                                                         |
| Building Block       | has collaborator | Building Block  | name              | A dependency it uses but does not own (injected service, repository, port).                         |
| Building Block       | exposes          | Behavior        |                   |                                                                                                     |
| Behavior             | has in / out     | Building Block  | name, cardinality | Parameter or return value typed by a building block.                                                |
| Behavior             | has in / out     | Primitive       | name, cardinality | Parameter or return value of a built-in type.                                                       |
| Behavior             | invokes          | Behavior        | order             | Call from one behavior to another, in sequence.                                                     |
| Behavior             | governs          | Rule            |                   | The rules a behavior enforces or follows. The only way a rule enters the model.                     |
| Scenario             | illustrates      | Rule            |                   |                                                                                                     |
| Manual Process       | invokes          | Behavior        | order             | The steps of a manual process, in sequence.                                                         |
| Actor                | performs         | Manual Process  |                   | Labelled "wykonuje" in the diagram.                                                                 |

**Cardinality** replaces a plain "optional" flag. It is one of `0..1`, `1`,
`0..*` and `1..*`, so a collection field and an optional field are told
apart.

**Order** on `invokes` gives the position of a call within the calling
behavior or manual process, so a sequence can be replayed step by step.

## 4. Kinds

### 4.1 Building block kinds

The diagram groups the kinds in six columns:

| Group                       | Kinds                                      |
| --------------------------- | ------------------------------------------ |
| Persistence and integration | Repository, External Integration           |
| Application                 | Application Service (an automated process) |
| Domain model                | Aggregate, Entity, Value Object (VO)       |
| Domain logic                | Domain Service, Factory                    |
| Adapters and technical code | In Adapter, Out Adapter, Technical Service |
| Messages                    | Event, Command, Query                      |

- **In Adapter** — an entry point that turns outside input into calls into the
  application (REST controller, message listener, CLI command).
- **Out Adapter** — the implementation of a port that talks to the outside
  (database, HTTP client, message publisher).
- **Technical Service** — a supporting service with no domain meaning
  (clock, id generator, mailer, serializer).
- **Event / Command / Query** — messages as types of their own. An event says
  something happened; a command asks for a change; a query asks for data.

### 4.2 Primitive kinds

`String`, `Int`, `Boolean`, `Decimal`, `UUID`.

Date and time is not a primitive. It is modelled as a value object.

### 4.3 Rule kinds

| Kind          | What the rule does                                                                                 |
| ------------- | -------------------------------------------------------------------------------------------------- |
| Validation    | Accepts or rejects input before anything changes.                                                  |
| State Change  | Says how state moves from one value to the next (allowed transitions).                             |
| Post          | Something that must hold, or happen, after a behavior completes (postcondition, follow-up effect). |
| Computation   | Derives a value from others (price, total, score).                                                 |
| Coordination  | Orders or ties together work across behaviors or building blocks.                                  |
| Configuration | A rule set by a setting rather than fixed in code (limits, thresholds, feature switches).          |

The rule kind is the only classification a rule has. The current split into
`category` (Business / Quality / Constraint) and `ruleType` is dropped.

## 5. What changes against the current contract

The current contract (`system-model.schema.json`) has three lists:
`modules`, `buildingBlocks` and `behaviors`.

| Area                    | Today                                                                                                                                                                                                         | New structure                                                                                                                                 |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| Module nesting          | Flat list; nesting only implied by the id (`module\|a.b`).                                                                                                                                                    | Explicit `Module contains Module`.                                                                                                            |
| Layer, Library          | Not modelled.                                                                                                                                                                                                 | New elements that contain building blocks.                                                                                                    |
| Deployment              | Not modelled.                                                                                                                                                                                                 | New Deployable Unit and Deployment Container.                                                                                                 |
| Actor                   | A string in `behavior.visibility.actors`.                                                                                                                                                                     | An element of its own, linked through Manual Process.                                                                                         |
| Manual Process          | Not modelled.                                                                                                                                                                                                 | New element; invokes behaviors in order.                                                                                                      |
| Building block kinds    | aggregate, entity, value_object, domain_service, application_service, repository, factory, external_integration.                                                                                              | Adds In Adapter, Out Adapter, Technical Service, Event, Command, Query.                                                                       |
| Command / Event / Query | `behavior.type`.                                                                                                                                                                                              | Building block kinds. A behavior has no type.                                                                                                 |
| Inheritance             | `implements` list on a building block.                                                                                                                                                                        | `extends` relation between building blocks.                                                                                                   |
| Collaborators           | Derived from invocations (see `code-model-to-system-model.md`, section 11).                                                                                                                                   | Explicit `has collaborator [name]`.                                                                                                           |
| State and parameters    | `properties`, `input`, `output` with `optional: boolean`.                                                                                                                                                     | `has state` / `has in / out` with `cardinality`.                                                                                              |
| Primitives              | String refs `primitive\|string`, `integer`, `boolean`, `decimal`, `uuid`, `datetime`.                                                                                                                         | Primitive as an element: String, Int, Boolean, Decimal, UUID. Date and time becomes a value object.                                           |
| Invocations             | `invokes` is an unordered list of behavior ids.                                                                                                                                                               | `invokes [order]`.                                                                                                                            |
| Rules                   | Attached to modules, building blocks and behaviors; categorised by `category` (Business / Quality / Constraint) and `ruleType` (Consistency, Structure, Computation, State change, Performance, Security, …). | Attached only to behaviors; kinds are Validation, State Change, Post, Computation, Coordination, Configuration. No `category`, no `ruleType`. |
| Scenarios               | Attached to building blocks and behaviors.                                                                                                                                                                    | Illustrate a rule.                                                                                                                            |
