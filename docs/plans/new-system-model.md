# Plan: introducing the new system model

Status: in progress (November 2026); steps 1 and 3 of section 11 are built,
step 3 before step 2: the two share files but neither needs the other.

[`system-model-structure.md`](system-model-structure.md) describes the
metamodel the system model moves to: its elements, relations and kinds. This
plan says how the service, the parsers, the design documents, the SPA and the
plugin get there, in which order, and what is decided on the way. It changes
the contract in `server/backend/src/app/system-model/system-model.ts` and
everything that reads it.

## 1. What the change touches

| Where                                                                   | What reads the system model there                                                                               |
| ----------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| `server/backend/src/app/system-model/`                                  | The contract (`system-model.ts`), the newest-model query                                                        |
| `server/backend/src/app/element-id.ts`                                  | The id kinds: `module`, `building_block`, `behavior`                                                            |
| `server/backend/src/app/scanners/system-model-builders/`                | The builder (`build-system-model.ts`, `type-resolution.ts`) and the vocabularies (`java`, `csharp`)             |
| `server/backend/src/app/design-docs/design-doc.ts`                      | Every `Designed*` shape mirrors a `Scanned*` one and shares its enums                                           |
| `server/backend/src/adapters/out/store/system-models.repository.ts`     | Reads `graph/system-models/*.json` with the contract                                                            |
| `server/backend/tools/contracts.ts`, `plugins/claude-code/contracts/`   | The JSON Schemas agents read (`system-model`, `design-document`) and the design document example                |
| `server/frontend/src/features/system-model/`                            | `designOf` (the scan read as a design), the exploration graph                                                   |
| `server/frontend/src/features/design-docs/`                             | The architecture view and its checks, the outline, the requirements view, the edit forms (`design-doc-edit.ts`) |
| `plugins/claude-code/skills/`                                           | `create-design-doc`, `update-design-doc`, `implement-java-spring`, `setup-java-scanner`, `setup-dotnet-scanner` |
| `code-parsers/java/annotations`, `NoesisVision.Annotations` (NuGet)     | The annotations that name building block kinds, behaviors and actors                                            |
| `server/backend/src/app/scanners/scanner.ts`, `adapters/out/scanners/`  | The scan gains a second input beside the code model: the repository's `*.feature` files (section 5)             |
| `examples/*/.noesis/graph/`                                             | Committed system models and design documents                                                                    |
| `server/backend/test/`, `server/frontend/test/`                         | Builder, contract, design doc and view specs, with their fixtures                                               |
| `docs/plans/code-model-to-system-model.md`, `docs/arch/ARCHITECTURE.md` | The projection rules and the architecture overview                                                              |

Relation to [`code-model-as-the-only-contract.md`](code-model-as-the-only-contract.md):
independent. That plan moves the vocabulary tables into the parsers; this one
changes what the tables say. This plan goes first, because it is the smaller
change to the vocabularies and the other plan then moves the new tables, not
the old ones.

## 2. Decisions

Taken on the structure document and on this draft; the sections below are
written to them. The ones marked _proposed_ are this plan's own and need a
yes.

1. **Elements and relations.** The file is a set of element lists, one per
   kind, and one `relations` list. An element carries only what is its own
   (id, name, description, kind, source); every relation of the structure
   document is one entry of `relations`, `{ kind, from, to }` with the
   attributes the diagram puts on the edge. A relation is read from either
   end by querying the list; nothing is stored twice. Rules and scenarios
   become elements with ids, so that `governs` and `illustrates` can name
   them.
2. **Containment is a relation and is in the id.** The id keeps the path
   (`building_block|sales.orders.Order`) because it is the element's identity
   everywhere a design or a link names it; the `contains` relation is written
   too, for every containment, so the relations list is complete. The builder
   writes both from one fact; a design document whose `contains` disagrees
   with an id's path breaks a writer's rule. _(proposed)_
3. **Cardinality replaces `optional` and `Collection`.** A `has_state`,
   `has_input` or `has_output` relation carries `cardinality`, one of `0..1`,
   `1`, `0..*`, `1..*`; its `to` is a `BuildingBlockId | PrimitiveId`, never
   a wrapper. A collection of optional elements and a collection of
   collections both read as `0..*`, the second with a diagnostic. _(proposed)_
4. **Primitives stay as they are**: `string`, `integer`, `decimal`,
   `boolean`, `date`, `datetime`, `duration`, `uuid`. A primitive is only ever
   a relation's `to`; there is no `primitives` list, because the id says
   which it is.
5. **Building block kinds**, as the JSON spells them: `aggregate`, `entity`,
   `value_object`, `domain_service`, `application_service`, `repository`,
   `factory`, `external_integration`, `in_adapter`, `out_adapter`,
   `technical_service`, `event`, `command`, `query`.
6. **A behavior has no type.** `ScannedBehavior.type` and `BehaviorType` go.
   The handler annotations (`@CommandHandler`, `@QueryHandler`,
   `@EventHandler`, `[EntryPoint]`, `[DomainBehavior]`) still mark a method
   as a behavior; they no longer say what kind.
7. **No visibility anywhere.** Neither the system model nor the design
   document says whether a behavior is public or private: `Visibility` goes
   from both contracts, and no view, check or form reads it. Who calls a
   behavior is read from the `invokes` relations that end at it; the
   scanner's candidates are public methods already (decision 4 of the
   projection document). `visibility.actors` becomes the `actors` list and
   the manual processes.
8. **Rules only on behaviors**, through `governs`, with one classification:
   `kind`, one of `validation`, `state_change`, `post`, `computation`,
   `coordination`, `configuration`. `category`, `ruleType` and
   `RULE_TYPES_OF` go; a module or a building block governs nothing.
9. **Rules and scenarios are Gherkin.** A rule is a `Rule:` of a feature
   file: its name the `Rule:` line, its description the free text under it,
   its kind a tag on it (`@validation`, `@state_change`, `@post`,
   `@computation`, `@coordination`, `@configuration`). A scenario is a
   `Scenario:` under the rule, its steps verbatim. The scenario's `When`
   section (the `When` step and the `And`/`But` steps after it) binds to
   step definitions — `@When("...")` in Cucumber, `[When("...")]` in
   Reqnroll — whose methods invoke exactly one behavior between them; that
   behavior governs the rule. The feature files run under Cucumber or
   Reqnroll, so what the scan reads is what the tests check. The scan makes
   a `rules` element per `Rule:`, a `scenarios` element per `Scenario:`, a
   `governs` relation from each distinct behavior bound by the rule's
   scenarios and an `illustrates` relation per scenario. A `Background:` is
   prepended to each scenario's steps; a `Scenario Outline:` is one
   scenario, its placeholders as written. Dropped with a diagnostic: a
   scenario outside a `Rule:`, a rule without a kind tag or with two, a
   `When` step matching no or several step definitions, a `When` section
   invoking no or several behaviors, a rule or scenario whose name is no
   `ElementName`. Today's `[Scenario]` on a behavior goes; the annotation
   libraries gain nothing for this.
10. **`implements` becomes `extends`**, same content: the building blocks
    among the types a block directly extends or implements.
11. **State and collaborators.** A member is `has_state` when its type is a
    primitive or a block of a domain-value kind (`aggregate`, `entity`,
    `value_object`, `event`, `command`, `query`), `has_collaborator` when its
    type is a block of any other kind (`repository`, `external_integration`,
    `domain_service`, `application_service`, `factory`, `in_adapter`,
    `out_adapter`, `technical_service`). Collaborators also come from
    constructor parameters typed by such a block. The kind decides alone: a
    domain service held as a strategy is a collaborator, an aggregate a
    repository caches is state.
12. **`invokes` is ordered**: the relation carries `order`, by the call
    site's location in the calling method, first call of each target kept,
    counting from 1. Today's sorted, unique list loses its sorting.
13. **Deployable units and libraries come from the code model's artifacts**:
    an artifact with `executable: true` is a deployable unit, any other a
    library; a deployable unit `contains` the modules its namespaces declare,
    a library `contains` the building blocks in them, as the structure says.
    Both are named by the artifact's name. _(proposed)_
14. **Layers come from an annotation on a package or namespace** (`@Layer`,
    `[Layer]`), new in both annotation libraries; a codebase without it has
    no layers. A building block is in the layer of the nearest annotated
    package above it. _(proposed)_
15. **Deployment containers and manual processes are never scanned.** They
    are authored in design documents. Actors are scanned where an annotation
    names one (`[Actor]` today; `@Actor` is new in the Java library), and
    authored otherwise.
16. **Ids.** One segment for the new top-level elements: `layer|<name>`,
    `library|<name>`, `deployable_unit|<name>`, `deployment_container|<name>`,
    `actor|<name>`, `manual_process|<name>`. A rule belongs to the module of
    the behavior that governs it, the first scenario's when several do:
    `rule|<module path>.<name>`; a scenario to its rule:
    `scenario|<rule path>.<name>`. Two feature files making one rule id is a
    diagnostic; the first by path wins. _(proposed)_
17. **No migration code.** The service is pre-release. A stored system model
    of the old shape stays on disk unread: `findNewest` reads only the files
    of the latest minute, so a scan after the upgrade hides it, and nothing
    lists all models. A stored design document of the old shape is rewritten
    by the agent or by hand; the committed ones in `examples/` and the test
    fixtures are rewritten in the pull request that changes their shape.
    _(proposed)_
18. **The design document follows the system model** shape for shape
    (section 7): the same element lists and one `relations` change set, so
    that a design can propose a manual process, an actor, a deployment
    container or a relation between elements the scan already has.

## 3. The contract

`server/backend/src/app/system-model/system-model.ts`, declarative as before
(object shapes, enums, discriminated unions, `.describe()`), because the JSON
Schema is generated from it.

### 3.1 Elements

```ts
BuildingBlockType = 'aggregate' | 'entity' | 'value_object' | 'domain_service'
  | 'application_service' | 'repository' | 'factory' | 'external_integration'
  | 'in_adapter' | 'out_adapter' | 'technical_service' | 'event' | 'command' | 'query'
RuleKind = 'validation' | 'state_change' | 'post' | 'computation' | 'coordination' | 'configuration'
PrimitiveId = as today: `primitive|${'string' | 'integer' | 'decimal' | 'boolean' | 'date' | 'datetime' | 'duration' | 'uuid'}`

ScannedElement = { id, name, description, source }            // the common part; source nullable where a scan never finds one
ScannedModule              = ScannedElement
ScannedLayer               = ScannedElement
ScannedLibrary             = ScannedElement
ScannedDeployableUnit      = ScannedElement
ScannedDeploymentContainer = ScannedElement
ScannedActor               = ScannedElement
ScannedManualProcess       = ScannedElement
ScannedBuildingBlock       = ScannedElement & { type: BuildingBlockType }
ScannedBehavior            = ScannedElement
ScannedRule                = ScannedElement & { kind: RuleKind }
ScannedScenario            = ScannedElement & { steps: ScenarioStep[] }   // as today; from a scan never empty
```

Every element is in a list named for its kind: `modules`, `layers`,
`libraries`, `deployableUnits`, `deploymentContainers`, `actors`,
`manualProcesses`, `buildingBlocks`, `behaviors`, `rules`, `scenarios`.

### 3.2 Relations

```ts
Cardinality = '0..1' | '1' | '0..*' | '1..*'
TypeId = BuildingBlockId | PrimitiveId

Relation = discriminated on `kind`:
  { kind: 'hosts',            from: DeploymentContainerId, to: DeployableUnitId }
  { kind: 'contains',         from: DeployableUnitId | ModuleId, to: ModuleId }
  { kind: 'contains',         from: ModuleId | LayerId | LibraryId, to: BuildingBlockId }
  { kind: 'extends',          from: BuildingBlockId, to: BuildingBlockId }
  { kind: 'has_state',        from: BuildingBlockId, to: TypeId, name, cardinality }
  { kind: 'has_collaborator', from: BuildingBlockId, to: BuildingBlockId, name }
  { kind: 'exposes',          from: BuildingBlockId, to: BehaviorId }
  { kind: 'has_input',        from: BehaviorId, to: TypeId, name, cardinality, position }
  { kind: 'has_output',       from: BehaviorId, to: TypeId, cardinality }
  { kind: 'invokes',          from: BehaviorId | ManualProcessId, to: BehaviorId, order }
  { kind: 'governs',          from: BehaviorId, to: RuleId }
  { kind: 'illustrates',      from: ScenarioId, to: RuleId }
  { kind: 'performs',         from: ActorId, to: ManualProcessId }

SystemModel = { id, name, scanned_at, commit, <the eleven element lists>, relations: Relation[] }
```

A relation carries only what the diagram puts on the edge: `name`,
`cardinality`, `order`. No `description`: a member's documentation (R5.6
today) is not in the model; what a slot means is the description of the
block or primitive it points at.

The two `contains` rows are one variant whose `from` and `to` are unions; the
pairs a `contains` may join are a writer's rule, not a schema. `has_input` and
`has_output` are the diagram's "has in / out" split by direction. A relation
is unique by `(kind, from, to)`, except `has_state`, `has_input` and
`has_collaborator`, unique by `(kind, from, name)`: a block may hold two
slots of one type. A `has_input` carries `position`, where the parameter
stands in the signature counting from 1 (added while building step 1: the
sort below would otherwise lose the order a signature is declared in).
Relations are sorted by `kind`, `from`, `position`, `to`, then `name` or
`order`, so two builds give one file and a signature reads in its order.

### 3.3 Ids

`server/backend/src/app/element-id.ts`: eight new kinds beside the three
there are. Six one-segment ones (decision 16) each with an `of(name)`
factory; `RuleId.within(module, name)` and `ScenarioId.within(rule, name)`
like `BuildingBlockId.within`. `ElementId` becomes the union of eleven,
`ElementId.match` takes eleven handlers, `isModule`/`isBuildingBlock`/`isBehavior`
gain their siblings. The frontend's `features/design-docs/element-id.ts`
(`kindOf`) follows.

The `SystemModel.describe()` text and the file-name contract stay.

## 4. The builder

`server/backend/src/app/scanners/system-model-builders/`. The builder emits
elements and relations instead of nested objects; the sections of
`code-model-to-system-model.md` that change, and how:

| Rule                     | Today                                                             | New                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| ------------------------ | ----------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| R4.4 `implements`        | blocks among directly implemented types                           | One `extends` relation each                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| R4.7 rules on a block    | empty                                                             | Gone                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| R5 properties            | `properties` with `optional`                                      | One `has_state` or `has_collaborator` relation per member, by decision 11, without the member's documentation (R5.6 goes); constructor parameters typed by a collaborator kind add `has_collaborator` (name: the parameter's)                                                                                                                                                                                                                                                                                                                     |
| R5.4 `optional`          | nullable or optional wrapper                                      | `cardinality`: `0..1` when nullable or an optional wrapper, `1` otherwise; `0..*` for a collection; `1..*` never from code                                                                                                                                                                                                                                                                                                                                                                                                                        |
| R6 modules               | a module per prefix of the path                                   | Same, plus one `contains` relation from each module to its child modules and its blocks                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| R7.3 collections         | `{ collectionOf }`                                                | The element type as `to` with cardinality `0..*`; a collection of a collection is `0..*` of the innermost element, with a diagnostic                                                                                                                                                                                                                                                                                                                                                                                                              |
| R9.3 identity            | `behavior\|<block path>.<name>`                                   | Same, plus one `exposes` relation from the block                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| R9.4 behavior type       | from the annotation, default `Command`                            | Gone                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| R9.5 visibility          | `public` with actors                                              | Gone; each actor role on a method becomes an `actors` element, and nothing on the behavior                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| R9.6, R9.7 input, output | nested parameters and results                                     | One `has_input` per parameter, one `has_output` per result, cardinality by R5.4                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| R9.9 scenarios           | one per scenario role                                             | Replaced by R12 (feature files)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| New: R12 feature files   | —                                                                 | Every `Rule:` of every feature file is a rule (name, description, kind by decision 9), every `Scenario:` under it a scenario with its steps. Each step of the `When` section is matched against the `stepDefinition` roles' expressions (cucumber expressions and regular expressions, as Cucumber matches them); the `INVOKES` of the matched methods must reach exactly one behavior, directly or through methods that are no behavior (as R11.1): it governs the rule, the scenario illustrates it. Sorted by feature file path, then position |
| R10.1 order              | lists sorted by id                                                | Elements by id; relations by section 3.2                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| R11.3 invokes            | sorted, unique                                                    | One `invokes` relation per target, `order` by `site.location` within the caller; a target called twice keeps its first order; calls reached through a non-behavior method come at that call's position                                                                                                                                                                                                                                                                                                                                            |
| New: artifacts           | —                                                                 | One `deployableUnits` element per `executable` artifact, one `libraries` element per other; `contains` to the modules of the namespaces the artifact's file declares (unit) or to the blocks in them (library); `source`: the artifact's `rootDirectory`                                                                                                                                                                                                                                                                                          |
| New: layers              | —                                                                 | One `layers` element per distinct `@Layer`/`[Layer]` name; `contains` to the blocks under the annotated packages, nearest annotation wins                                                                                                                                                                                                                                                                                                                                                                                                         |
| New: actors              | —                                                                 | One `actors` element per distinct actor name among the actor roles                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| New: kinds               | messages and adapters are `value_object` / `external_integration` | `@Command` → `command`, `@Query` → `query`, `@Event`, `[DddDomainEvent]` → `event`, `@Adapter(PRIMARY)` → `in_adapter`, `@Adapter(SECONDARY)` → `out_adapter`, `@TechnicalService` → `technical_service`; `[ReadModel]` stays `value_object`                                                                                                                                                                                                                                                                                                      |

`vocabulary.ts` gains the `layer`, `technicalService` and `stepDefinition`
roles (the last on Cucumber's `io.cucumber.java.en.When` and Reqnroll's
`Reqnroll.WhenAttribute` only, not SpecFlow's, with the expression
argument); it loses the
`scenario` role and the `type` on the `behavior` role. `type-resolution.ts` returns `{ ref,
cardinality }` instead of a `BuildingBlockRef` that may wrap a collection.

The builder keeps its property: two builds from one code model give one
model, every drop a diagnostic.

## 5. Annotations, feature files and parsers

Every new fact in code is an annotation the parsers already carry through
(`Annotation` with literal, enum and type arguments). Rules and scenarios
are not in code at all: they are in the feature files the scan reads beside
the code model. The code model does not change.

**Java** (`code-parsers/java/annotations`, released with the parser): add
`@TechnicalService` (type), `@Layer(String)` (package) and `@Actor(String)`
(method, repeatable). `@Adapter(Direction)` and
`@ExternalIntegration(Direction)` stay; the builder reads the direction.
Nothing for scenarios: the step definitions are Cucumber's.

**C#** (`NoesisVision.Annotations`, a NuGet package outside this repository):
`[TechnicalService]` and `[Layer]` on a namespace or assembly. The vocabulary
maps `[Adapter]`-style attributes when the package has them; until a release,
C# has no in or out adapter or layer, and `[ExternalSystemIntegration]` stays
`external_integration`. Step definitions are Reqnroll's.

**Feature files.** A rule and its scenarios read:

```gherkin
Feature: Placing orders

  @validation
  Rule: Non-empty order
    An order must have at least one line.

    Scenario: An order without lines is refused
      Given a customer with no lines picked
      When the customer places the order
      Then the order is refused
```

with the step definition that binds the `When` step:

```java
@When("the customer places the order")
public void theCustomerPlacesTheOrder() {
    result = orders.place(customer, List.of());
}
```

The scan reads every `*.feature` file Git tracks under the repository root,
through the `SourceRepository` port (`GitSourceRepository` lists them), and
parses it with `@cucumber/gherkin`, the official parser (one dependency in
the backend, so keywords in every Gherkin language, tables and doc strings
come for free), into feature, rules, scenarios, tags and steps. A `When`
step's text is matched to the `stepDefinition` roles' expressions with
`@cucumber/cucumber-expressions`, the matching Cucumber itself does. Both
live in `app/scanners/feature-files/`: the reading is a port, the parsing
and the matching are domain logic. `Scanner` (`app/scanners/scanner.ts`)
runs the code parser, reads the feature files, and hands both to the
builder.

**Test sources.** The .NET parser parses every project of the solution, test
projects included, so a C# step definition is in the code model today. The
Java parser parses main sources only (`noesis:parse` after
`process-classes`); it has to read the test source roots too
(`src/test/java`, after `process-test-classes` in Maven, the `test` source
set in Gradle) and write them into the same artifact. The golden code models
of both parsers gain the test fixtures' step definitions, and the fixtures
gain feature files; the service's unit tests project them.

## 6. Stored files

- `graph/system-models/*.json`: decision 17; no code.
- `graph/changes/**/*.design-doc.json` in `examples/discounts-dotnet`,
  `examples/discounts-java`, `examples/qdoc-java`, the frontend fixture
  `test/fixtures/qdoc-create-a-qdoc.design-doc.json` and
  `server/backend/tools/design-doc.example.json`: rewritten in each step that
  changes their shape, so the JSON Schema example test stays green.
- `examples/*/.noesis/graph/system-models/*.json`: regenerated with the real
  parsers at the end (step 7), the e2e toolchain tests asserting them.

## 7. Design documents

`server/backend/src/app/design-docs/design-doc.ts` mirrors the contract:

- One change set per element list, each `Designed*` as the `Scanned*` with
  `DesignDocField` on every value and `diagram` where a block or a behavior
  has one today; `DesignedRule` keeps `needs` and `rationale`;
  `DesignedScenario` keeps its steps as a field.
- `relations: changeSet(DesignedRelation, RelationKey)`, keyed as section
  3.2 says a relation is unique; `cardinality`, `order` and `position` are
  `DesignDocField`s, so a design may change a slot's cardinality, a
  call's order or a parameter's place without removing and re-adding the
  relation. So is the `to`
  of a `has_state` or `has_input`, which is no part of their key: a design
  may change a slot's type in place, and a modified slot need not repeat
  the type it keeps (decided while building step 1). A designed property's
  `description` goes with the scanned one.
- The nested `properties`, `input`, `output`, `implements`, `rules`,
  `scenarios`, `type` (behavior) and `visibility` go.
- A new writer's rule (`invalid-design-doc-error.ts`): every relation's ends
  exist, in the design or in the system model; a `contains` agrees with the
  id path; the `from` and `to` kinds are ones the relation allows.
- A writer's rule for decision 11 (`slotOutsideTypeKind`, added while
  building step 3): a `has_state` or `has_collaborator` whose `to` is a
  block the design or the model gives a kind must be the relation that
  kind asks for; a type of unknown kind passes.

The handlers do not change in kind; their fixtures do.

## 8. Frontend

- `features/system-model/system-model.model.ts` (`designOf`): the element
  lists and the relations, each row unchanged.
- `features/system-model/system-model-exploration.ts`: the graph is the
  relations list read as is; `uses` becomes the `has_state`, `has_input` and
  `has_output` relations, `invokes` keeps its order for the sequence player;
  `extends`, `has_collaborator` and `contains` are new relation filters.
- `features/design-docs/design-doc-architecture.ts`, `architecture-outline.ts`:
  placement by kind — `application_service` as today; `in_adapter` and the
  manual processes on the driving side; `repository`, `external_integration`,
  `out_adapter` as driven ports; `technical_service` beside them; `event`,
  `command`, `query` with the domain core as the messages the ports carry.
  Driving ports are the behaviors of application services and in adapters;
  their actors are read through `performs` and `invokes`.
- `architecture-checks.ts`: "every public behavior names its actors" becomes
  "every driving port is invoked by a manual process or an in adapter"; the
  `exposed` band of a hexagon (behaviors reached past the ports) is read from
  `invokes` across modules; the domain-core checks take the new kinds into
  their lists.
- `design-doc-edit.ts`: the kind lists, `RULE_TYPES_OF` and the `optional`
  fields go; a relation editor (kind, from, to, attributes) replaces the
  property, parameter and result forms; forms for the new elements.
- `design-doc-requirements.ts`, `design-doc-outline.ts`, `rule-sections.ts`:
  rules are read through `governs`; a rule's phrase is its kind.
- `shell/search/search-entries.ts`, `nav-items.ts`: the new element kinds
  are searchable and reachable.

Each visible change goes through the `design-system` skill's proposal step
before it is built.

## 9. Skills and documents

- `create-design-doc`, `update-design-doc`: elements and relations as two
  halves of a design; the rule guidance (no category, a kind instead),
  cardinality on a relation, where scenarios live, the new elements and when
  to author a manual process or a deployment container.
- `implement-java-spring`: the handler annotations no longer fix a type; the
  new annotations; `references/mapping.md`. For every rule and scenario of
  the design it writes the feature file (`Rule:` with the kind tag and the
  rule's description, `Scenario:` with the design's steps) and the step
  definitions, whose `When` invokes the behavior that governs the rule, and
  runs them under Cucumber; a scanned scenario then matches the designed one
  by name. A C# counterpart does the same with Reqnroll when there is one.
- `create-design-doc`, `update-design-doc`: a designed scenario's steps are
  written as the Gherkin steps they become.
- `setup-java-scanner`, `setup-dotnet-scanner`: the annotation tables.
- `docs/plans/code-model-to-system-model.md`: the rules of section 4 are
  edited in place and a section 14 records this change; `docs/arch/ARCHITECTURE.md`
  (the scanner and knowledge-graph paragraphs); `design-doc-architecture-view.md`
  (placement and checks).

## 10. Tests

- `server/backend/test/unit/system-model.spec.ts`,
  `contracts-json-schema.spec.ts`: the element lists, the relation variants,
  the uniqueness and sorting; the schema stays declarative.
- `system-model-builder.spec.ts` (73 cases today): one case per rule changed
  in section 4; new `describe`s for relations, artifacts, layers, actors,
  collaborators, invocation order and R12.
- `feature-files.spec.ts`: reading a feature file into rules and scenarios,
  `Background` and `Scenario Outline`, matching `When` text to expressions,
  every diagnostic of decision 9.
- `csharp-parser.spec.ts`, `java-parser.spec.ts`,
  `test/support/csharp-fixture-expectations.ts`: the shop fixtures' expected
  models, including the ordered `invokes` and the rules and scenarios of
  their feature files.
- `design-doc.spec.ts`, `design-doc-handlers.spec.ts`, `stored-design-doc.spec.ts`:
  fixtures in the new shape; the relation writer's rules.
- `server/frontend/test/*.spec.ts(x)`: `system-model.spec.tsx`,
  `system-model-exploration.spec.tsx`, `design-doc-architecture.spec.ts`,
  `design-doc-edit.spec.ts`, `search-entries.spec.ts` and the fixtures under
  `test/fixtures/`.
- `test/e2e-toolchain/*.e2e.spec.ts`: the examples' regenerated models.

## 11. Steps

One pull request per step, each green on `bun run ci`; a step that touches a
parser or an example also runs `bun run test:e2e:toolchain`. Every step
changes the contract, the builder, the design document, the SPA, the
fixtures and the skills together, so no step leaves two shapes alive.

1. **Relations** (decisions 1, 2, 3, 10, 12): the `relations` list with the
   kinds the model has today — `contains`, `extends`, `has_state`,
   `exposes`, `has_input`, `has_output`, `invokes` with `order` — replacing
   `implements`, `properties`, `input`, `output`, `optional`, `Collection`
   and the nested `invokes`; the design document's `relations` change set
   and writer's rules; the exploration graph and the edit forms read it.
   The biggest step, and the one every other builds on. _Built_: the
   forms keep their shape (a property, an input, an output and an
   extended type are still edited as parts of their element, written as
   relations), with a cardinality choice where the optional and collection
   switches were; the exploration draws `extends` as a third relation; the
   committed example models and design documents were converted by script
   rather than regenerated, the real regeneration staying in step 7.
2. **Rules and scenarios** (decisions 8, 9, 16): `rules` and `scenarios`
   as elements with ids, `governs` and `illustrates`, `RuleKind`; the
   feature file reader and the step matching, the `stepDefinition` role and
   R12 in the builder; the Java parser reading test sources; `RuleCategory`,
   `RuleType`, `RULE_TYPES_OF`, the C# `[Scenario]` mapping and the skills'
   rule guidance; the shop fixtures' feature files.
3. **Kinds** (decisions 5, 6, 11): the fourteen kinds, no behavior type,
   `has_collaborator`, the vocabularies' new rows, the architecture view's
   placement. _Built_, before step 2: `has_collaborator` comes from
   members and from constructor parameters of a collaborator kind
   (code-model-to-system-model.md R5.9), with no cardinality; Java's
   `@Adapter` reads its direction, `@TechnicalService` is in the vocabulary
   ahead of the annotation library (step 7). The architecture view keeps its
   rings: an in adapter sits with the application services and its public
   behaviors are driving ports, out adapters and technical services are
   driven ports, the messages join the domain core. The SPA moves the C, Q
   and E icons and tones from behaviors to the message blocks, draws
   collaborators in a section of their own (read, not yet written there),
   and the exploration gains a Collaborators relation. The committed
   examples were converted by script again, so a collaborator a constructor
   alone names appears only after step 7's regeneration.
4. **Actors and manual processes** (decisions 7, 15, 16): `ActorId`,
   `ManualProcessId`, `actors`, `manualProcesses`, `performs`, `invokes`
   from a process, `visibility` goes, the driving-port check and the forms.
5. **Deployable units and libraries** (decision 13): `DeployableUnitId`,
   `LibraryId`, the artifact projection and its `contains`.
6. **Layers and deployment containers** (decisions 14, 15): `LayerId`,
   `DeploymentContainerId`, the `layer` role, `hosts`, design-only
   containers.
7. **Annotation libraries and examples**: `@TechnicalService`, `@Layer`,
   `@Actor` in `code-parsers/java/annotations`, released as `java-v*`; the
   NuGet package's release when it is there; the examples annotated, their
   rules and scenarios moved into feature files with Cucumber or Reqnroll
   step definitions, and their system models regenerated; the setup skills'
   tables.
8. **Scenario generation in the skills**: section 9's `implement-java-spring`
   change, checked against `examples/qdoc-java`.
9. **Documents**: section 9's edits; `code-model-to-system-model.md` marked
   as superseded in the rules this plan changed.

## 12. Open questions

1. **The C# package.** Steps 3, 6 and 7 need a release of
   `NoesisVision.Annotations` for the new attributes; until then C# has no
   adapters, layers or technical services.
2. **Feature files outside Git.** The scan reads tracked files only; a
   generated or ignored feature file is not read. Fine for a repository,
   open for a scratch checkout.
