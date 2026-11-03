# Design: projecting the code model onto the system model

The second stage of the scanner. The first stage (one per language, the
Roslyn parser for C#) writes the **code model**: declarations, edges and
stubs, see [`docs/arch/code-model.md`](../arch/code-model.md).
This stage reads that model and writes the **system model** the server keeps
in `.noesis/graph/system-models/`: its elements, one list per kind, and the
relations between them (section 14),
see `server/backend/src/app/system-model/system-model.ts`. It runs in the
TypeScript server, once for every language, and knows a language only through
its **annotation vocabulary**: which annotation types mean what, which
platform types are the model's primitives, which are collections. Beside the
code model it reads the repository's feature files (R12) and its library
manifests (R14).

This document states the rules of the system model builder. Section 12 records the
decisions taken on the first draft, section 13 the implementation. The old
.NET scanner (`Noesis-old/Sources/Scanner/Scanner/Analysis/Domain`) is the
source of the general rules on generics and invocations; it is not followed
where a decision in section 12 says otherwise (annotation inheritance,
namespace-wide annotations).

## 1. Inputs and output

| Input                         | Where from                                                                                                                                                                                                           |
| ----------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `ParseManifest` + model files | The first stage's output directory; the manifest lists the files in dependency order and names the language                                                                                                          |
| Annotation vocabulary         | One per language, in code (section 2); chosen by the manifest's `language`                                                                                                                                           |
| `.noesis/settings.json`       | In the repository: `parser` (which parser reads the repository, by `language`, with its settings: the `java` parser's `command`), `engine` (the Java presets' engine), `namespacePartsToSkip`, `namespacesToExclude` |
| Clock, repository name        | From the scanner adapter, as today                                                                                                                                                                                   |
| Feature files                 | Every `*.feature` file Git tracks under the repository root, read through the `SourceRepository` port (R12)                                                                                                          |
| `.noesis/libraries/*.json`    | In the repository: one manifest per library the scan does not read, by file name (R14)                                                                                                                               |

Output: the element lists (`modules`, `buildingBlocks`, `behaviors`,
`rules`, `scenarios`, `actors`, `deployableUnits`, `libraries`, `layers`;
`manualProcesses` and `deploymentContainers` always empty, as no scan finds
one) and the `relations` of one `SystemModel`, plus diagnostics. The stage
is a pure function of its inputs; the adapter around it mints the id, stamps
the time, reads the files and logs the diagnostics.

## 2. The annotation vocabulary

The stage reads annotations by the **id of their type** (`Annotation.type`
is a `named` `TypeRef` whose `type` is a node or stub id) and their
**arguments by parameter name** (`name`, `markdownText`, a direction). A
vocabulary maps annotation ids to the roles below; everything the stage does
with an annotation goes through a role, so Java's
`vision.noesis.annotations` is a second table, not a second builder.

| Role             | Meaning                                                                                                                                 | C# (`NoesisVision.Annotations`)                                                                                                                                                                                                                                                                                                                                                                      |
| ---------------- | --------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `buildingBlock`  | The type is a building block of the given `BuildingBlockType`; `name` overrides its name; a direction argument may pick the type (R4.1) | `DddAggregate` → aggregate, `DddEntity` → entity, `DddValueObject` → value_object, `DddDomainService` → domain_service, `DddApplicationService` → application_service, `DddRepository` → repository, `DddFactory` → factory, `ExternalSystemIntegration` → external_integration; the messages `Command` → command, `Query` → query, `Event` and `DddDomainEvent` → event; `ReadModel` → value_object |
| `behavior`       | The method is a behavior; `name` overrides its name; it says nothing of a type (R9.4)                                                   | `DomainBehavior`, `EntryPoint` (`TriggeredBy` is not read)                                                                                                                                                                                                                                                                                                                                           |
| `actor`          | Who drives the system: the `actor` argument (C# `name`) becomes an `actors` element (R9.5)                                              | `Actor`                                                                                                                                                                                                                                                                                                                                                                                              |
| `description`    | The element's description, Markdown                                                                                                     | `ShortDescription` (`markdownText`)                                                                                                                                                                                                                                                                                                                                                                  |
| `stepDefinition` | The method is a step definition a feature file's `When` step binds to, by its expression (R12)                                          | Reqnroll's `When` (`expression`); Java: Cucumber's `io.cucumber.java.en.When` (`value`)                                                                                                                                                                                                                                                                                                              |
| `layer`          | The namespace, and those below it no nearer annotation claims, is in the named layer (R15)                                              | none yet; Java: `Layer` (`value`) on `package-info.java`                                                                                                                                                                                                                                                                                                                                             |
| `exclude`        | The element is not in the system model (section 3)                                                                                      | `ExcludeFromDocs`                                                                                                                                                                                                                                                                                                                                                                                    |
| ignored          | Read for nothing in this iteration                                                                                                      | `DomainModel`, `NotDomainModel`, `DomainModule`, `DddBoundedContext`, `SkipNamespaceInDomainModulesHierarchy` (section 12: no namespace-wide annotations yet), `DomainObject` alone, `CoreConcept`, `Exemplary`, `PublicContract`, `ExternalContract`, `Process`, everything under `People` except `Actor`, everything under `Technology`                                                            |

An argument whose literal is `null` (an attribute's optional parameter left
out, which Roslyn reports as `null`) counts as absent.

The Java vocabulary (`vision.noesis.annotations`, in
`java.vocabulary.ts`): `AggregateRoot` → aggregate, `DomainEntity` → entity,
`ValueObject` and `Identifier` → value_object, `DomainService`,
`ApplicationService`, `Repository`, `Factory` as named,
`ExternalIntegration` → external_integration whatever its direction,
`Adapter(Direction.PRIMARY)` → in_adapter and `Adapter(Direction.SECONDARY)`
→ out_adapter (the `value` argument), `TechnicalService` → technical_service,
the messages `Command` → command,
`Query` → query, `Event` → event; `CommandHandler`, `QueryHandler` and
`EventHandler` are `behavior` roles that mark a behavior and say nothing
more (R9.4). `Actor` is the `actor` role, its name the `value` argument,
repeatable (two or more on one element come in its `Actor.Actors`
container); `Layer` the `layer` role on a package (R15). No Java
annotation has a description or exclude role yet, and `Module` is a
package annotation (decision 13). Primitives are the eight keywords and the
`java.lang` boxes, `String`, `BigDecimal`, `UUID` and the `java.time` types;
collections are the `java.util` collection interfaces and classes and
`Stream`; `Map` and its kin are dictionaries; `CompletableFuture`,
`CompletionStage` and `Future` are looked through, `Optional` makes a slot `0..1`,
`Void` is nothing.

Besides annotations the vocabulary names, per language:

- the **primitives**: `PrimitiveTypeRef.name` and platform type ids that are
  the model's `primitive|…` (section 7.2);
- the **collections**: type ids whose first type argument is the element
  (section 7.3), and the **dictionaries**, which resolve to nothing (7.3);
- the **transparent wrappers**: type ids the stage looks through (`Task<T>`,
  `ValueTask<T>`) and the **optional wrapper** `Nullable<T>`;
- the **technical member names** never taken for behaviors (section 9.1).

A vocabulary entry is matched on the annotation type's id alone. The
annotation package's own inheritance (`DddAggregateAttribute :
DomainObjectAttribute`) is not consulted: the table lists every concrete
attribute.

## 3. Scope: what is in the model

- **R3.1 Excluded artifact.** An artifact whose `artifact.annotations` carry
  an `exclude` role contributes no module, block or behavior
  (`[assembly: ExcludeFromDocs]` on `TechnicalStuff`). Its nodes are still
  read: a type reference into it, or a call into it, resolves as usual.
- **R3.2 Excluded namespace.** A `namespacesToExclude` pattern of
  `.noesis/settings.json` drops the namespace and everything in it. (An
  `exclude` role with `ApplyOnNamespace = true` is read as a plain element
  exclusion; the namespace-wide form is not supported yet, section 12.)
- **R3.3 Excluded element.** A type, method, property or field with an
  `exclude` role is not in the model. Exclusion is not inherited by derived
  types or overriding members, and it hides nothing else: an excluded type's
  methods still take part in the invocation walk (section 11).
- **R3.4 Generated members** (`origin: generated`) are never behaviors or
  properties. A generated getter can still make the field it reads a
  property (R5.8).
- **R3.5 Stubs** are never elements: an external type has no annotations the
  stage could read. A stub takes part only in type resolution (section 7).

## 4. Building blocks

- **R4.1 Own annotation.** A type node of kind `class`, `struct`,
  `interface` or `enum` with a `buildingBlock` role is a building block of
  that type. A `delegate` is not. Nothing is inherited: a type without its
  own annotation is no block, whatever it extends or implements (section
  12, decision 3). Two `buildingBlock` roles on one type: the first wins,
  with a diagnostic. A role that reads a direction (Java's `@Adapter`)
  takes the type its enum argument's member names, `PRIMARY` an
  in_adapter, `SECONDARY` an out_adapter, and its own type when the member
  is missing or unknown.
- **R4.2 Name.** The `name` argument of the annotation when it is an
  `ElementName` (no `.`, no `|`, not blank), else the name from the code,
  with a diagnostic when an override was dropped. The name from the code is
  the node's `name` (`Repository` for ``Repository`1``) and, for a nested
  type, the code names of the enclosing types first, separated by spaces:
  `Order.Repository` is `Order Repository`, `Order.Item.Detail` is
  `Order Item Detail`. An annotation name replaces the whole composed name.
- **R4.3 Identity.** `building_block|<module path>.<name>`, the module
  being that of the type's namespace (section 6), the namespace of the
  outermost enclosing type for a nested one. Two types that resolve to one
  id keep the first in scan order (manifest order of artifacts, then node
  order) and drop the rest with a diagnostic.
- **R4.4 `extends`.** One `extends` relation from the block to each block
  among the types the node directly `EXTENDS` or `IMPLEMENTS` (one hop,
  type arguments ignored: `IRepository<Order>` is the block
  `IRepository`), each once. (Was the `implements` list; section 14.)
- **R4.5 Description.** The `description` role's text, else the node's
  `documentation`, else null.
- **R4.6 Source.** The node's first location: `path`, `startLine`.
- **R4.7 Rules and scenarios** are no part of a block: they come from
  feature files (R12) and attach to behaviors.

## 5. State of a building block

Each property below is one `has_state` relation from the block: `name`,
`to` (the resolved type) and `cardinality` (section 14) — unless the type
is a block of a collaborator kind (R5.9), when it is a `has_collaborator`.

- **R5.1 Candidates.** The property and field nodes the block `CONTAINS`
  that are `public` (or, in Java, exposed by a getter, R5.8), not static,
  not generated and not excluded. Not a candidate: an event (accessors
  `add`/`remove`), an indexer (`parameters` not empty), an enum member, a
  constant (`constantValue` not null).
- **R5.2 One name, one property.** A field and a property whose names match
  after stripping leading underscores and case (`_total` and `Total`) are
  one property; the property node wins.
- **R5.3 Type.** The member's `type` resolved by section 7. A member whose
  type resolves to nothing is left out, with a diagnostic at debug level
  (a `Data` interface, a `Func<…>`, a technical type).
- **R5.4 `cardinality`.** `0..1` when the type reference is `nullable` or
  wraps `Nullable<T>` or `Optional<T>`; `0..*` for a collection (R7.3);
  `1` otherwise. `1..*` never comes from code.
- **R5.5 One name, one slot.** The member found first by source location
  (file, line), then by name, keeps the name; the relations themselves are
  sorted as section 14 says.
- **R5.6 No `description`.** A member's documentation is not in the
  model: what a slot means is the description of the block or primitive it
  points at.
- **R5.7 Record components.** A field the parser marks
  `java.isRecordComponent` is a candidate although it is private: a Java
  record's state is its components, read through accessors the parser marks
  the same way, which are therefore not behaviors (R9.1). A C# positional
  record needs no such rule: its components are public properties.
- **R5.8 Fields behind getters.** In Java (the manifest's language) a field
  that is not public is a candidate when the block's type declares a getter
  for it: a method that is `public`, not static, takes no parameters, and
  is named `getX` for the field `x`, `isX` when the field is a `boolean` or
  `Boolean`, or `x` itself (Lombok's fluent accessors, and a hand-written
  `isActive()` for the field `isActive`). The getter returns exactly the
  field's type, nullability aside, so `String getTotal()` exposes no
  `long total`; it may be declared or generated (Lombok's `@Value`,
  `@Data`, `@Getter`), and the field must otherwise be a candidate: an
  instance field, no constant, not generated, not excluded. A getter that
  makes its field a property is not a behavior (R9.1), unless a
  `behavior` role says it is. Getters are looked up on the type itself,
  not inherited, and only by these names; a C# getter method exposes
  nothing, since C# state is already a public property.
- **R5.9 State or collaborator.** The kind of the block a slot is typed by
  decides alone: a primitive, or a block of a domain-value kind
  (`aggregate`, `entity`, `value_object`, `event`, `command`, `query`), is
  state; a block of any other kind (`domain_service`,
  `application_service`, `repository`, `factory`, `external_integration`,
  `in_adapter`, `out_adapter`, `technical_service`) is a collaborator, one
  `has_collaborator` relation with `name` and `to` and no cardinality. A
  constructor's parameters add collaborators too: each parameter, of every
  constructor of the block (declared or generated, not excluded, in
  source order), whose type resolves to a block of a collaborator kind is
  one `has_collaborator` under the parameter's name, unless a member or an
  earlier parameter already holds that name. A parameter of any other
  type is passed over without a diagnostic: what it says, a member says.

## 6. Modules

- **R6.1 Namespace to module path.** A namespace's dotted name goes through
  `.noesis/settings.json` as today: an excluded pattern drops it and everything
  it contains (R3.2); the `namespacePartsToSkip` sequences are removed
  wherever they occur. What is left is the module path; a namespace that is
  left with nothing, and the global namespace, map to no module, and the
  blocks declared there are dropped with a diagnostic (a block needs a
  module).
- **R6.2 Which modules exist.** A module for every prefix of the module
  path of every building block: nothing for a namespace that holds no block
  directly or below. `Sales.Orders.Order` makes `module|Sales` and
  `module|Sales.Orders`, and one `contains` relation from each module to
  each child module and to each block in it.
- **R6.3 Name.** The last segment of the path. (Renaming a module through
  `DomainModule`/`DddBoundedContext` with `ApplyOnNamespace`, and skipping
  a level through `SkipNamespaceInDomainModulesHierarchy`, wait for
  namespace-wide annotations, section 12.)
- **R6.4 Source.** The first location of the first namespace node (scan
  order) whose name maps to the module's path: its `file` and `startLine`.
  A module path that no namespace node maps to (a prefix created only by
  skipping) takes the directory of the nearest descendant module's file,
  `line: null`, as the Java parser does today.
- **R6.5 `description`**: null; the annotation package has no description
  for a namespace.

## 7. Resolving a type reference

A `TypeRef` resolves to a block id or a `primitive|…` with a cardinality,
or to nothing. The rules apply in this order; the first that fits decides.

- **R7.1 Transparent wrappers.** A `named` reference to `Task<T>`,
  `ValueTask<T>` resolves as `T`; to `Nullable<T>` as `T`, with the
  cardinality `0..1` (R5.4).
  A non-generic `Task`/`ValueTask`, `void` and `dynamic` resolve to nothing.
- **R7.2 Primitives.** A `primitive` reference by name (`bool` → boolean;
  `byte`, `sbyte`, `short`, `ushort`, `int`, `uint`, `long`, `ulong`,
  `nint`, `nuint` → integer; `float`, `double`, `decimal` → decimal;
  `string`, `char` → string; `object` → nothing), and a `named` reference to
  a platform type by id: `System.Guid` → uuid; `System.DateTime`,
  `System.DateTimeOffset`, `NodaTime.Instant`, `NodaTime.ZonedDateTime`,
  `NodaTime.LocalDateTime`, `NodaTime.OffsetDateTime` → datetime;
  `System.DateOnly`, `NodaTime.LocalDate` → date; `System.TimeSpan`,
  `NodaTime.Duration`, `NodaTime.Period` → duration.
- **R7.3 Collections.** An `array` resolves to its element with the
  cardinality `0..*`. A `named` reference to a collection type of the vocabulary
  (`IEnumerable<T>`, `ICollection<T>`, `IList<T>`, `IReadOnlyCollection<T>`,
  `IReadOnlyList<T>`, `ISet<T>`, `IReadOnlySet<T>`, `List<T>`,
  `HashSet<T>`, `SortedSet<T>`, `Queue<T>`, `Stack<T>`, `LinkedList<T>`,
  `IAsyncEnumerable<T>`, `IQueryable<T>`, `ImmutableArray<T>`,
  `ImmutableList<T>`, `IImmutableList<T>`, `ImmutableHashSet<T>`,
  `IImmutableSet<T>`, `Span<T>`, `ReadOnlySpan<T>`, `Memory<T>`,
  `ReadOnlyMemory<T>`) resolves to its element argument with the
  cardinality `0..*`. An element that resolves to nothing makes the whole
  reference resolve to nothing. A collection of collections is `0..*` of
  the innermost element, with an info diagnostic. A dictionary
  (`IDictionary<K,V>`, `IReadOnlyDictionary<K,V>`, `Dictionary<K,V>`,
  `ImmutableDictionary<K,V>`) is a collection of key-value pairs, which the
  model cannot express; it resolves to nothing, with a diagnostic, until
  the contract has a pair (section 12, decision 7).
- **R7.4 Building blocks.** A `named` reference whose `type` id, looked up
  from the referencing artifact (section 8), is a building block resolves to
  that block, whatever its type arguments (`IRepository<Order>` is
  `IRepository`).
- **R7.5 Type parameters.** A `typeParameter` reference resolves through the
  `type` constraints of the parameter it names (found on the owner node by
  ordinal): when exactly one constraint resolves, that is the result
  (`T : Entity`), else nothing. The old scanner followed constraints the
  same way.
- **R7.6 Looking through an unmapped generic.** A `named` reference to a
  type that is no block, no collection and no wrapper, but has type
  arguments, resolves as its arguments do when exactly one of them resolves
  (`Result<Order>`, `Maybe<Money>`, `Page<Offer>`); with none or several
  (`Func<decimal, decimal>`, `KeyValuePair<ClientId, Money>`) it resolves to
  nothing. This generalises the old scanner's walk over generic arguments to
  the one slot the model offers.
- **R7.7 Everything else** (`tuple`, `function`, `pointer`, `unresolved`, an
  unannotated enum, a stub that is no primitive) resolves to nothing.

## 8. Resolving ids across artifacts

Ids are unique within one artifact file. A reference from artifact A to id
X is looked up in A's own nodes, then in A's dependencies of kind `source`
in the manifest's order, each with its own dependencies after it, then in
A's stubs. The builder keeps one index per artifact and one global list of
blocks keyed by (artifact, node id), so two projects that both declare
`Sales.Domain.Order` are two candidates for one block id and R4.3 decides.
Namespaces merge by dotted name across artifacts: `N:Sales.Domain` in two
projects is one module.

## 9. Behaviors

- **R9.1 Candidates.** The method nodes a block `CONTAINS` with
  `methodKind: method` (constructors, static initialisers, destructors and
  operators are not behaviors), `public`, not generated, not excluded, not a
  record component's accessor (R5.7) or a getter that makes its field a
  property (R5.8), and not a technical member: `Equals`, `GetHashCode`,
  `GetType`, `ToString`, `Finalize`, `MemberwiseClone`, `Clone`,
  `Deconstruct`, `PrintMembers`, `CompareTo`. Static methods are
  candidates (`Money.Of`, `Order.Factory.NewWith`); interface members are
  public. A method with a `behavior` role is a candidate whatever its
  visibility and name.
- **R9.2 Name.** The `name` of a `behavior` role on the method, else on
  the member it `OVERRIDES` or `IMPLEMENTS_MEMBER`, nearest first (so the
  interface's `[DomainBehavior("Place order")]` names the implementation's
  behavior too), when it is an `ElementName`; else the node's `name`.
- **R9.3 Identity.** `behavior|<block id path>.<name>`, and one `exposes`
  relation from the block to the behavior. Overloads share a name and so
  an id: the overload with the most parameters stands for them, the first
  in node order when several have as many (the Java parser's rule: a
  design's optional last input becomes an overload without it).
- **R9.4 No type.** A behavior has no type: the `behavior` role marks a
  method and says nothing more. What kind of message a behavior handles is
  the kind of the block it takes (a `has_input` to a `command`, `query` or
  `event`). Was the `Command`, `Query` or `Event` read from `TriggeredBy` or
  fixed by Java's handler annotations; section 14.
- **R9.5 Actors.** A behavior says nothing of who may call it. The `actor`
  roles on the method, on the members it overrides or implements, and on
  the containing type each name an `actors` element, `actor|<name>`, one
  per distinct name, its `source` where it is first named (behaviors by
  id); no relation joins it to the behavior. A name that is no
  `ElementName` is dropped with a diagnostic. Was the behavior's
  `visibility`; section 14.
- **R9.6 Input.** One `has_input` relation per parameter whose type
  resolves (section 7): `name`, `to`, `cardinality` by R5.4, `0..1`
  also when the parameter is `optional` (has a default), and `position`,
  the parameter's place among those that resolve, counting from 1 in
  declaration order. A parameter whose
  type resolves to nothing is left out (`CancellationToken`, a `Func<…>`),
  with a debug diagnostic.
- **R9.7 Output.** The return type resolved through R7.1 first: nothing for
  `void`, `Task`, `ValueTask`; else one `has_output` relation when the type
  resolves, with its cardinality; else none.
- **R9.8 Description.** The `description` role on the method, else its
  `documentation`, else the first either of the other overloads has, else
  null.
- **R9.9 Scenarios** come from feature files (R12), not from annotations.
- **R9.10 Source.** The chosen overload's first location.
- **R9.11 A `behavior` role on a method of a type that is no block** has no
  home (`BehaviorId` needs a block) and is dropped with a diagnostic; so is
  one on an interface or delegate type.

## 10. Order, determinism, diagnostics

- **R10.1** Every element list is sorted by id (code unit order);
  `relations` by kind, `from`, `position`, `to`, then `name` or `order`
  (section 14). Two builds from one code model give one output.
- **R10.2** Every drop and every fallback above is a diagnostic: the stage
  returns them beside the model (`{ model, diagnostics }`), the adapter logs
  them (`info` for a dropped element or override, `debug` for a member whose
  type resolves to nothing), and nothing is written into the system model,
  which has no slot for them.

## 11. Relations derived from invocations

The old scanner derived three relations between elements:

| Old relation                     | How it was found                                                                                                                                                                                                                                                            | Home in the system model                                                                                         |
| -------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| `DomainObject.UsesObject`        | The types of a type's fields and properties, generic arguments walked, arrays unwrapped; the source is the type and every base type and interface that is a domain object                                                                                                   | `has_state` and `has_collaborator` relations (sections 5, 7)                                                     |
| `DomainBehavior.UsesObject`      | The parameter, return and constraint types of the behavior's method, and of every method it calls                                                                                                                                                                           | `has_input` and `has_output` relations (section 9) for the method's own signature; the called methods' have none |
| `DomainBehavior.InvokesBehavior` | From a method call: the caller resolved to its behaviors (the method, its base methods and the interface members it implements), the callee to a behavior; a callee that is no behavior is walked through its own outgoing calls, transitively, until behaviors are reached | `invokes` relations with `order` (R11.3; added by this design, section 12)                                       |

- **R11.1 Source of a call.** An `INVOKES` edge whose `from` is a method
  is attributed to the behaviors of that method: the behavior the method
  stands for or is an overload of, and the behaviors of every member it
  `OVERRIDES` or `IMPLEMENTS_MEMBER`, transitively (so a call inside
  `SqlOrderRepository.Save`, which is no block, counts for the interface
  behavior `Order Repository.Save`). A call from a property or field
  initialiser is attributed to nothing.
- **R11.2 Target of a call.** The behaviors of the invoked method, found
  the same way (the method's own, then those of the members it overrides or
  implements). When it has none, the invoked method is a step: its own
  `INVOKES` edges are followed, each method visited once per walk, until
  methods with behaviors are reached. Steps may cross blocks and artifacts
  and pass through excluded types; the walk stops at stubs, at constructors
  and at methods with no outgoing calls.
- **R11.3 Shape.** One `invokes` relation per behavior reached, never the
  behavior itself, with `order`: the calls of every method attributed to
  the behavior (R11.1) in the order of their sites (file, line, column),
  each target at its first call, numbered from 1; a target reached through
  a method that is no behavior comes at the position of the call to that
  method.
- **R11.4 Creation.** `INVOKES` of a constructor is a use of the created
  block, not a call of a behavior; the system model has no slot for it.

## 12. Decisions

Taken on the first draft of this document; the rules above are written to
them.

1. **Invocations** are in the system model: `ScannedBehavior.invokes:
   BehaviorId[]` (default empty), filled by section 11. The design document's
   `DesignedBehavior` does not carry it yet; the dummy scanner leaves it
   empty. _Superseded (section 14): `invokes` relations with `order`, which
   a design document writes too._
2. **Messages are value objects.** `Command`, `Query`, `Event`,
   `DddDomainEvent` and `ReadModel` become `value_object` blocks.
   _Superseded (section 14): the messages are `command`, `query` and
   `event`; `ReadModel` stays `value_object`._
3. **No annotation inheritance.** Every block is annotated itself. The old
   scanner's walk over base types and interfaces is not implemented.
4. **Public methods only** are behaviors.
5. **Public members only** are properties, and in Java the fields a getter
   exposes (R5.8), since Java state sits behind getters, often Lombok's.
6. **The behavior type comes from the annotation** (`EntryPoint`,
   `TriggeredBy`), never from the return type or the name. A behavior
   without one is a `Command`, the one default this design takes on its own;
   it is written here so it can be changed in one place. _Superseded
   (section 14): a behavior has no type (R9.4)._
7. **Dictionaries are collections of key-value pairs.** The contract cannot
   say so (`BuildingBlockRef` is a block, a primitive or a collection of
   one); until it can, a dictionary resolves to nothing. Open: add a pair
   (`{ pairOf: [key, value] }` or a tuple) to `BuildingBlockRef`. _Since
   section 14 a slot's type is a block or a primitive with a cardinality;
   the pair is still open, and a dictionary still resolves to nothing._
8. **Looking through unmapped generics** (R7.6) stays.
9. **Scenarios** were mapped by title only, from a `Scenario` annotation;
   since step 2 of the new model (section 14) they come from feature files
   with their steps, and the annotation is not read.
10. **`[assembly: DomainModule]`** and a `DomainModule` without
    `ApplyOnNamespace` are ignored, without a log line.
11. **Running the first stage.** The C# adapter runs `noesis-parse-csharp`
    (from `PATH`, or the command `NOESIS_DOTNET_SCANNER` names) into the
    session directory and projects its output; the regex reader is gone.
    The server's unit tests project a committed code model of an annotated
    fixture solution, so they need no .NET; an end-to-end test scans
    `examples/discounts-dotnet` with the real tool and measures both stages
    against a time budget, so a performance regression fails there.
12. **Nested types** take their enclosing types' names into their own
    (R4.2).
13. **`NotDomainModel`** and every **namespace-wide annotation**
    (`ApplyOnNamespace = true`) are not supported yet.

## 13. Implementation

**Where.** `server/backend/src/app/scanners/system-model-builders/`: the
system model builder, pure functions over the two contracts, in the app layer
because they are domain logic every parser's code model goes through.

| File                      | What                                                                                                                                   |
| ------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| `vocabulary.ts`           | The `AnnotationVocabulary` interface: roles by annotation id, primitives, collections, wrappers                                        |
| `library-manifest.ts`     | The shape of a `.noesis/libraries/*.json` manifest (R14)                                                                               |
| `csharp.vocabulary.ts`    | Section 2's C# table                                                                                                                   |
| `java.vocabulary.ts`      | The Java table                                                                                                                         |
| `annotations.ts`          | Reading an annotation's arguments: literals unquoted, `null` as absent, enum members                                                   |
| `code-model-index.ts`     | Per-artifact lookup of nodes, stubs and edges; cross-artifact resolution (section 8)                                                   |
| `namespace-config.ts`     | `NamespaceConfig` (moved from the C# adapter; the file reading stays in the adapter) and R6.1                                          |
| `type-resolution.ts`      | Section 7                                                                                                                              |
| `build-system-model.ts`   | Sections 3 to 6, 9 to 11 and R12 to R15: the model of a code model and the feature files, with diagnostics                             |
| `system-model-builder.ts` | `SystemModelBuilder`: picks the vocabulary by the manifest's language and builds over the namespace settings and the library manifests |

Reading and matching feature files is in `app/scanners/feature-files/`:
`feature-file.ts` parses one with `@cucumber/gherkin`, `step-expression.ts`
matches a step's text with `@cucumber/cucumber-expressions`.

The scan itself is domain logic too: `Scanner`
(`app/scanners/scanner.ts`) takes a `CodeParser`
(`app/scanners/code-parsers/code-parser.ts`), a `SystemModelBuilder` and a
`SourceRepository` (`app/scanners/source-repository.ts`: the repository's
name, its head commit and its feature files, which `GitSourceRepository`
in `adapters/out/scanners/` lists with `git ls-files`), runs the parser and
reads the feature files, builds the system model of both, reports the
diagnostics through the `ScanLog` port and returns the `SystemModel`.
`ScannerFactory` builds the builder at every scan over the namespace
settings and the library manifests `ScannerSettingsRepository` reads. The adapters are only parsers:
`CSharpParser` and `JavaParser` (`adapters/out/scanners/code-parsers/`) run their
tool, and read and validate the files it wrote with the `code-model.ts` schemas.

**Tests.** `server/backend/test/unit/system-model-builder.spec.ts`: one
`describe` per section above, one `it` per rule, over a small builder that
makes a `CodeModelFile` in a few lines. `test/unit/csharp-parser.spec.ts`
reads the .NET parser's golden code model of the fixture solution under
`code-parsers/dotnet/test/fixtures/` (`CSharpSyntax/Projection` holds the
annotated types; `code-parsers/dotnet/test/Noesis.Parser.Tests/golden/` is
regenerated with `NOESIS_UPDATE_GOLDEN=1 dotnet test`) and checks the whole
chain without .NET. `test/e2e-toolchain/csharp-parser.e2e.spec.ts` builds the .NET
parser, scans the same fixture through `CSharpParser` and asserts the model
and the time each stage took. The expected `invokes` of every chain in the
fixture are in `test/support/csharp-fixture-expectations.ts`, shared by both.

## 14. The new system model (November 2026)

[`new-system-model.md`](new-system-model.md) moved the system model to
elements and relations, in steps. Each step edited the rules above that it
changed in place, and marked the decisions of section 12 it overturned as
superseded; this section records what each step changed, and holds the
rules the new model added (R12 to R15).

The first step of [`new-system-model.md`](new-system-model.md) moved what a
building block or behavior held of other elements out of the elements and
into one `relations` list of the `SystemModel`, each
`{ kind, from, to, … }` carrying only what the diagram puts on the edge.
The rules above are edited to it; what changed, in short:

| Was                                            | Is                                                                                       |
| ---------------------------------------------- | ---------------------------------------------------------------------------------------- |
| `ScannedBuildingBlock.implements`              | `extends` relations (R4.4)                                                               |
| `ScannedBuildingBlock.properties` (`optional`) | `has_state` relations with `name`, `to`, `cardinality` (section 5)                       |
| `ScannedBehavior.buildingBlockId`              | `exposes` relations (R9.3); the block is still in the id                                 |
| `ScannedBehavior.input`, `output`              | `has_input` with `cardinality`, `position`; `has_output` with `cardinality` (R9.6, R9.7) |
| `ScannedBehavior.invokes: BehaviorId[]`        | `invokes` relations with `order` (R11.3)                                                 |
| `{ collectionOf }`                             | the element type as `to` with the cardinality `0..*` (R7.3)                              |
| nothing                                        | `contains` relations from each module to its modules and blocks (R6.2)                   |

A slot's type (`to`) is a block id or a `primitive|…`, never a wrapper; its
`cardinality` is one of `0..1`, `1`, `0..*`, `1..*`. A relation is unique by
`(kind, from, to)`, except `has_state` and `has_input`, unique by
`(kind, from, name)`; the list is sorted by `kind`, `from`, `position`, `to`,
then `name` or `order`, so a behavior's parameters keep the order they are
declared in. A member's documentation (R5.6) is no longer in the model. The
design document mirrors the list as one `relations` change set
(`server/backend/src/app/design-docs/design-doc.ts`).

The kinds step of the plan (step 3) changed, in short:

| Was                                                      | Is                                                                                       |
| -------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| messages (`Command`, `Query`, `Event`, …) → value_object | `command`, `query`, `event` (section 2)                                                  |
| `Adapter` → external_integration                         | `in_adapter` or `out_adapter` by its direction (R4.1)                                    |
| nothing                                                  | `technical_service`, read once the annotation library has it                             |
| every member a `has_state`                               | `has_collaborator` for a block of a collaborator kind, constructor parameters too (R5.9) |
| `ScannedBehavior.type` (R9.4)                            | gone                                                                                     |

`has_collaborator` is unique by `(kind, from, name)`, as `has_state` is.

The actors step of the plan (step 4) changed, in short:

| Was                                               | Is                                                              |
| ------------------------------------------------- | --------------------------------------------------------------- |
| `ScannedBehavior.visibility`, `public` or private | gone, from the design document too                              |
| actors as names in `visibility.actors`            | an `actors` list of its own, one element per name (R9.5)        |
| nothing                                           | a `manualProcesses` list, never scanned: a design authors it    |
| `invokes` from a behavior                         | `invokes` from a behavior or a manual process; `performs` added |

The rules and scenarios step of the plan (step 2) changed, in short:

| Was                                                           | Is                                                                                  |
| ------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| `rules` on modules, blocks, behaviors, `category`, `ruleType` | a `rules` list of its own, `kind` the one classification, `governs` from behaviors  |
| `scenarios` on blocks, behaviors, rules, from `[Scenario]`    | a `scenarios` list of its own, read from feature files, `illustrates` to their rule |
| the `scenario` role                                           | the `stepDefinition` role on Cucumber's and Reqnroll's `When`                       |

**R12 Rules and scenarios from feature files.** The scan reads every
`*.feature` file Git tracks under the repository root and hands them to the
builder beside the code model (`app/scanners/feature-files/`).

- **R12.1 A rule** is a `Rule:` with exactly one kind tag (`@validation`,
  `@state_change`, `@post`, `@computation`, `@coordination`,
  `@configuration`); other tags are not read. Its name is the `Rule:` line,
  its description the text under it, its common indentation taken off,
  null when there is none; its source the feature file and the `Rule:`'s
  line.
- **R12.2 A scenario** is a `Scenario:` or `Scenario Outline:` under a rule:
  its steps the feature's `Background:` steps, then the rule's, then its
  own, each as written (`And`, `But`, `*` take the kind before them,
  `given` at the start; tables and doc strings are not kept). An outline is
  one scenario, its placeholders as written.
- **R12.3 Binding.** Each `When` step (and the `And`/`But` after it) is
  matched to the step definitions' expressions as the language's step
  library matches them, a Cucumber expression with the built-in parameter
  types unless the library reads a regular expression: cucumber-jvm when
  it starts with `^` or ends with `$`, or is written `/…/`; Reqnroll when
  it starts with `^` or ends with `$`, or, holding no `{parameter}`, shows
  a regular expression's idioms (`(.*)`, `\d+`, `\.`), anchored at both
  ends when it is not. An outline's step is matched with its first
  example's values filled in. Java's repeated
  `@When` is read through its container annotation. The behaviors the
  matched methods reach — directly, or through methods that are no
  behavior, as a call does (R11.2) — must be exactly one: it governs the
  rule, and the scenario illustrates it.
- **R12.4 Ids.** A rule is `rule|<module path>.<name>`, in the module of the
  behavior its first binding scenario reaches; a scenario is
  `scenario|<rule path>.<name>`. A rule is governed once by each distinct
  behavior its scenarios reach.
- **R12.5 Order.** Feature files by path, then as each states its rules; the
  first of two rules with one id wins, and the first of two scenarios of
  one name in a rule. Elements are sorted by id, relations as section 14
  says.
- **R12.6 Dropped, with a diagnostic:** a file the Gherkin parser refuses; a
  scenario under no `Rule:`; a rule with no kind tag or with two; a rule or
  scenario whose name is no `ElementName`; a scenario without steps; a
  `When` step matching no step definition or several; a scenario whose
  `When` steps reach no behavior or several; a rule none of whose scenarios
  binds; a rule or scenario whose id another took first; a step definition
  whose expression is none (an unknown parameter type, a broken regular
  expression).

The deployable units and libraries step of the plan (step 5) changed, in
short:

| Was                      | Is                                                                                  |
| ------------------------ | ----------------------------------------------------------------------------------- |
| nothing                  | a `deployableUnits` and a `libraries` list, one element per artifact (R13)          |
| `contains` from a module | `contains` from a module, a deployable unit (to a module) or a library (to a block) |

**R13 Deployable units and libraries from the artifacts.** Every artifact
of the manifest that is not excluded (R3.1) and declares at least one
building block becomes an element.

- **R13.1 A deployable unit** is an artifact with `executable: true`. It
  `contains` each module that directly holds one of its blocks — not the
  modules above them, which every artifact's namespaces declare.
- **R13.2 A library** is any other artifact. It `contains` each of its
  blocks.
- **R13.3 Name and id.** The artifact's `name`, whole: a C# project's
  `MyCompany.Sales.DeepModel` is one name, so the ids
  `deployable_unit|<name>` and `library|<name>` take dots as part of it
  (`ArtifactName`, never empty, padded or with `|`). Its `source` is the
  artifact's `rootDirectory`, `line: null`; the repository root is `.`; no
  root directory, no source. `description` is null.
- **R13.4 Dropped, with a diagnostic:** an artifact that declares no
  building block (a test project, an artifact all of whose namespaces are
  excluded); an artifact whose name is no `ArtifactName`; the second of two
  artifacts with one id, the first in manifest order winning.

**R14 Libraries described by hand.** A package the code depends on is never
parsed: the code model holds only stubs of the types the code reaches, with
no annotations. A library manifest, one JSON file per library under
`.noesis/libraries/` (shape: `library-manifest.ts` in
`app/scanners/system-model-builders/`), says which of those types are
building blocks. The scan reads the files, by file name, at every scan, and
refuses an invalid one.

- **R14.1 A listed block** is a type the manifest names by its code-model
  id without the `T:` (`MyCompany.Shared.Money`, `Order+Line`, ``Result`1``),
  of the manifest's `kind`. Its module is its namespace's, mapped as R6.1
  maps a scanned block's; its `description` the manifest's; its `source`
  the manifest file, `line: null`. It has no behaviors, state or relations
  of its own.
- **R14.2 Name.** The manifest's `name`, else the type's own: nested types
  joined by a space (R4.2), a generic's arity left out. A module that only
  listed blocks are in has the manifest as its source.
- **R14.3 Resolution.** A type reference no parsed artifact declares
  resolves to the listed block of its id, wherever a block may be named: a
  slot's type (state or collaborator by the block's kind, decision 11), a
  parameter, a result, a supertype.
- **R14.4 The library.** Each manifest is a library (`library|<name>`,
  R13.3), after the scanned ones, containing its kept blocks; its `source`
  is the manifest file.
- **R14.5 Dropped, with a diagnostic:** a listed type a parsed artifact
  declares (annotate it instead); one in the global namespace or one that
  maps to no module; one listed twice (the first manifest by file name
  wins); one whose id a block took first; a manifest none of whose blocks is
  kept; a library whose id a scanned artifact or an earlier manifest took.

The layers and deployment containers step of the plan (step 6) changed, in
short:

| Was                                           | Is                                                                                                  |
| --------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| nothing                                       | a `layers` list, one element per layer name (R15), and a `deploymentContainers` list, never scanned |
| `contains` from a module, a unit or a library | the same, and from a layer to a block                                                               |
| nothing                                       | `hosts`, from a deployment container to a deployable unit, authored in designs only                 |

**R15 Layers from package and namespace annotations.** A layer annotation
(the `layer` role: Java's `@Layer("<name>")`, written on the package's
`package-info.java`; none in C# until the annotation package has one) on a
namespace node of an artifact that is not excluded names a layer.

- **R15.1 A layer** is one element per distinct name, `layer|<name>`; its
  `source` is the annotated package's `package-info.java` when the
  namespace has a location there, else its first location; `description`
  is null.
- **R15.2 Containment.** A building block is in the layer of the nearest
  annotated namespace at or above its own: one `contains` from that layer
  to the block. A block under no annotated namespace is in no layer, and a
  codebase without the annotation has no layers.
- **R15.3 One namespace, one layer.** Annotated namespaces are read by
  dotted name, then by artifact id; the first annotation of a namespace
  wins, so a package two artifacts annotate apart takes the first.
- **R15.4 Dropped, with a diagnostic:** a second layer annotation on one
  namespace; a name that is no `ElementName`; a later artifact's different
  layer for a namespace already in one; a layer no block is in.
