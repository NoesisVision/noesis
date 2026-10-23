# Design: projecting the code model onto the system model

The second stage of the scanner. The first stage (one per language, the
Roslyn scanner for C#) writes the **code model**: declarations, edges and
stubs, see [`docs/arch/code-model.md`](../arch/code-model.md).
This stage reads that model and writes the **system model** the server keeps
in `.noesis/graph/system-models/`: modules, building blocks and behaviours,
see `server/backend/src/app/system-model/system-model.ts`. It runs in the
TypeScript server, once for every language, and knows a language only through
its **annotation vocabulary**: which annotation types mean what, which
platform types are the model's primitives, which are collections.

This document states the rules of the system model builder. Section 12 records the
decisions taken on the first draft, section 13 the implementation. The old
.NET scanner (`Noesis-old/Sources/Scanner/Scanner/Analysis/Domain`) is the
source of the general rules on generics and invocations; it is not followed
where a decision in section 12 says otherwise (annotation inheritance,
namespace-wide annotations).

## 1. Inputs and output

| Input                        | Where from                                                                                                                                                                                                        |
| ---------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `ScanManifest` + model files | The first stage's output directory; the manifest lists the files in dependency order and names the language                                                                                                       |
| Annotation vocabulary        | One per language, in code (section 2); chosen by the manifest's `language`                                                                                                                                        |
| `.noesis/settings.json`      | In the repository: `scanner` (which scanner reads the repository), `codeModel` (the command line of the `code-model` scanner), `engine` (the Java presets' engine), `namespacePartsToSkip`, `namespacesToExclude` |
| Clock, repository name       | From the scanner adapter, as today                                                                                                                                                                                |

Output: the `modules`, `buildingBlocks` and `behaviours` of one
`SystemModel`, plus diagnostics. The stage is a pure function of its inputs;
the adapter around it mints the id, stamps the time, reads the files and logs
the diagnostics.

## 2. The annotation vocabulary

The stage reads annotations by the **id of their type** (`Annotation.type`
is a `named` `TypeRef` whose `type` is a node or stub id) and their
**arguments by parameter name** (`name`, `TriggeredBy`, `markdownText`). A
vocabulary maps annotation ids to the roles below; everything the stage does
with an annotation goes through a role, so Java's
`vision.noesis.annotations` is a second table, not a second builder.

| Role            | Meaning                                                                                                             | C# (`NoesisVision.Annotations`)                                                                                                                                                                                                                                                                                                                                                                                                               |
| --------------- | ------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `buildingBlock` | The type is a building block of the given `BuildingBlockType`; `name` overrides its name                            | `DddAggregate` → aggregate, `DddEntity` → entity, `DddValueObject` → value_object, `DddDomainService` → domain_service, `DddApplicationService` → application_service, `DddRepository` → repository, `DddFactory` → factory, `ExternalSystemIntegration` → external_integration; the messages `Command`, `Query`, `Event`, `DddDomainEvent`, `ReadModel` → value_object (the model has no message types; the Java scanner maps them the same) |
| `behaviour`     | The method is a behaviour; `name` overrides its name; `TriggeredBy`, or a type the role itself fixes, sets its type | `DomainBehavior`, `EntryPoint` (`TriggeredBy`: `Command`, `Query`, `Event`; `Unspecified` says nothing)                                                                                                                                                                                                                                                                                                                                       |
| `actor`         | Who calls: `name` goes to the behaviour's `visibility.actors`                                                       | `Actor`                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| `description`   | The element's description, Markdown                                                                                 | `ShortDescription` (`markdownText`)                                                                                                                                                                                                                                                                                                                                                                                                           |
| `scenario`      | A scenario of the block or behaviour, by title only (section 9.9)                                                   | `Scenario` (`name`)                                                                                                                                                                                                                                                                                                                                                                                                                           |
| `exclude`       | The element is not in the system model (section 3)                                                                  | `ExcludeFromDocs`                                                                                                                                                                                                                                                                                                                                                                                                                             |
| ignored         | Read for nothing in this iteration                                                                                  | `DomainModel`, `NotDomainModel`, `DomainModule`, `DddBoundedContext`, `SkipNamespaceInDomainModulesHierarchy` (section 12: no namespace-wide annotations yet), `DomainObject` alone, `CoreConcept`, `Exemplary`, `PublicContract`, `ExternalContract`, `Process`, everything under `People` except `Actor`, everything under `Technology`                                                                                                     |

An argument whose literal is `null` (an attribute's optional parameter left
out, which Roslyn reports as `null`) counts as absent.

The Java vocabulary (`vision.noesis.annotations`, in
`java.vocabulary.ts`): `AggregateRoot` → aggregate, `DomainEntity` → entity,
`ValueObject` and `Identifier` → value_object, `DomainService`,
`ApplicationService`, `Repository`, `Factory` as named,
`ExternalIntegration` and `Adapter` → external_integration, the messages
`Command`, `Query`, `Event` → value_object; `CommandHandler`,
`QueryHandler` and `EventHandler` are `behaviour` roles that carry no
argument and fix the type themselves (R9.4). No Java annotation has a
description, actor, scenario or exclude role yet, and `Module` is a
package annotation (decision 13). Primitives are the eight keywords and the
`java.lang` boxes, `String`, `BigDecimal`, `UUID` and the `java.time` types;
collections are the `java.util` collection interfaces and classes and
`Stream`; `Map` and its kin are dictionaries; `CompletableFuture`,
`CompletionStage` and `Future` are looked through, `Optional` marks optional,
`Void` is nothing.

Besides annotations the vocabulary names, per language:

- the **primitives**: `PrimitiveTypeRef.name` and platform type ids that are
  the model's `primitive|…` (section 7.2);
- the **collections**: type ids whose first type argument is the element
  (section 7.3), and the **dictionaries**, which resolve to nothing (7.3);
- the **transparent wrappers**: type ids the stage looks through (`Task<T>`,
  `ValueTask<T>`) and the **optional wrapper** `Nullable<T>`;
- the **technical member names** never taken for behaviours (section 9.1).

A vocabulary entry is matched on the annotation type's id alone. The
annotation package's own inheritance (`DddAggregateAttribute :
DomainObjectAttribute`) is not consulted: the table lists every concrete
attribute.

## 3. Scope: what is in the model

- **R3.1 Excluded artifact.** An artifact whose `artifact.annotations` carry
  an `exclude` role contributes no module, block or behaviour
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
- **R3.4 Generated members** (`origin: generated`) are never behaviours or
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
  with a diagnostic.
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
- **R4.4 `implements`.** The blocks among the types the node directly
  `EXTENDS` or `IMPLEMENTS` (one hop, type arguments ignored:
  `IRepository<Order>` is the block `IRepository`), sorted, unique.
- **R4.5 Description.** The `description` role's text, else the node's
  `documentation`, else null.
- **R4.6 Source.** The node's first location: `path`, `startLine`.
- **R4.7 `rules`**: empty; nothing in the annotation package expresses a
  rule. **`scenarios`**: one per `scenario` role on the type (section 9.9).

## 5. Properties of a building block

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
- **R5.4 `optional`.** True when the type reference is `nullable` or wraps
  `Nullable<T>`; false otherwise.
- **R5.5 Order.** By source location (file, line) of the member, then by
  name; name is the key, so two members cannot share one.
- **R5.6 `description`**: the member's `documentation`, else that of the
  getter that exposes it (R5.8), else null.
- **R5.7 Record components.** A field the scanner marks
  `java.isRecordComponent` is a candidate although it is private: a Java
  record's state is its components, read through accessors the scanner marks
  the same way, which are therefore not behaviours (R9.1). A C# positional
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
  makes its field a property is not a behaviour (R9.1), unless a
  `behaviour` role says it is. Getters are looked up on the type itself,
  not inherited, and only by these names; a C# getter method exposes
  nothing, since C# state is already a public property.

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
  `module|Sales.Orders`.
- **R6.3 Name.** The last segment of the path. (Renaming a module through
  `DomainModule`/`DddBoundedContext` with `ApplyOnNamespace`, and skipping
  a level through `SkipNamespaceInDomainModulesHierarchy`, wait for
  namespace-wide annotations, section 12.)
- **R6.4 Source.** The first location of the first namespace node (scan
  order) whose name maps to the module's path: its `file` and `startLine`.
  A module path that no namespace node maps to (a prefix created only by
  skipping) takes the directory of the nearest descendant module's file,
  `line: null`, as the Java scanner does today.
- **R6.5 `description`**: null; the annotation package has no description
  for a namespace. `rules`: empty.

## 7. Resolving a type reference

A `TypeRef` resolves to a `BuildingBlockRef` (a block id, a `primitive|…`,
or `{ collectionOf }`) or to nothing. The rules apply in this order; the
first that fits decides.

- **R7.1 Transparent wrappers.** A `named` reference to `Task<T>`,
  `ValueTask<T>` resolves as `T`; to `Nullable<T>` as `T`, marked optional.
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
- **R7.3 Collections.** An `array` resolves to `{ collectionOf: element }`.
  A `named` reference to a collection type of the vocabulary
  (`IEnumerable<T>`, `ICollection<T>`, `IList<T>`, `IReadOnlyCollection<T>`,
  `IReadOnlyList<T>`, `ISet<T>`, `IReadOnlySet<T>`, `List<T>`,
  `HashSet<T>`, `SortedSet<T>`, `Queue<T>`, `Stack<T>`, `LinkedList<T>`,
  `IAsyncEnumerable<T>`, `IQueryable<T>`, `ImmutableArray<T>`,
  `ImmutableList<T>`, `IImmutableList<T>`, `ImmutableHashSet<T>`,
  `IImmutableSet<T>`, `Span<T>`, `ReadOnlySpan<T>`, `Memory<T>`,
  `ReadOnlyMemory<T>`) resolves to a collection of its element argument. An
  element that resolves to nothing makes the whole reference resolve to
  nothing. A dictionary (`IDictionary<K,V>`, `IReadOnlyDictionary<K,V>`,
  `Dictionary<K,V>`, `ImmutableDictionary<K,V>`) is a collection of
  key-value pairs, which `BuildingBlockRef` cannot express; it resolves to
  nothing, with a diagnostic, until the contract has a pair (section 12,
  decision 7).
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

## 9. Behaviours

- **R9.1 Candidates.** The method nodes a block `CONTAINS` with
  `methodKind: method` (constructors, static initialisers, destructors and
  operators are not behaviours), `public`, not generated, not excluded, not a
  record component's accessor (R5.7) or a getter that makes its field a
  property (R5.8), and not a technical member: `Equals`, `GetHashCode`,
  `GetType`, `ToString`, `Finalize`, `MemberwiseClone`, `Clone`,
  `Deconstruct`, `PrintMembers`, `CompareTo`. Static methods are
  candidates (`Money.Of`, `Order.Factory.NewWith`); interface members are
  public. A method with a `behaviour` role is a candidate whatever its
  visibility and name.
- **R9.2 Name.** The `name` of a `behaviour` role on the method, else on
  the member it `OVERRIDES` or `IMPLEMENTS_MEMBER`, nearest first (so the
  interface's `[DomainBehavior("Place order")]` names the implementation's
  behaviour too), when it is an `ElementName`; else the node's `name`.
- **R9.3 Identity.** `behavior|<block id path>.<name>`. Overloads share a
  name and so an id: the overload with the most parameters stands for them,
  the first in node order when several have as many (the Java scanner's
  rule: a design's optional last input becomes an overload without it).
- **R9.4 Type.** The `TriggeredBy` of the `behaviour` role on the method,
  or on the member it overrides or implements, when it is `Command`, `Query`
  or `Event`; else the type the role itself fixes, when the vocabulary gives
  it one (Java's `@CommandHandler`, `@QueryHandler`, `@EventHandler`, which
  carry no argument). Without either the behaviour is a `Command`: the type
  is the annotation's to say (section 12, decision 6), and the model has no
  "unknown". Nothing is read from the return type or the name.
- **R9.5 Visibility.** `public` with its actors when the node is `public`,
  else `private` (a `behaviour` role on a non-public method). Actors: the
  `actor` roles on the method, on the members it overrides or implements,
  and on the containing type, as names, sorted and unique.
- **R9.6 Input.** One `ScannedParameter` per parameter whose type resolves
  (section 7), in declaration order: `name`, `type`, `optional` when the
  parameter is `optional` (has a default) or its type is nullable,
  `description` null. A parameter whose type resolves to nothing is left out
  (`CancellationToken`, a `Func<…>`), with a debug diagnostic.
- **R9.7 Output.** The return type resolved through R7.1 first: nothing for
  `void`, `Task`, `ValueTask`; else one `ScannedResult` when the type
  resolves, with `optional` from nullability; else none.
- **R9.8 Description.** The `description` role on the method, else its
  `documentation`, else the first either of the other overloads has, else
  null.
- **R9.9 Scenarios.** One `ScannedScenario` per `scenario` role on the
  chosen overload and its siblings, with the role's `name` as its name,
  no description and no steps (the annotation carries a title only; the
  contract now allows that, section 12). A role without a name, or with one
  that is no `ElementName`, is dropped with a diagnostic. The same for a
  block's scenarios (R4.7).
- **R9.10 Source.** The chosen overload's first location.
- **R9.11 A `behaviour` role on a method of a type that is no block** has no
  home (`BehaviorId` needs a block) and is dropped with a diagnostic; so is
  one on an interface or delegate type.

## 10. Order, determinism, diagnostics

- **R10.1** `modules`, `buildingBlocks` and `behaviours` are sorted by id
  (code unit order), `implements`, `actors` and `invokes` too; properties by
  R5.5; input by declaration order. Two scans of one code model give one
  output.
- **R10.2** Every drop and every fallback above is a diagnostic: the stage
  returns them beside the model (`{ model, diagnostics }`), the adapter logs
  them (`info` for a dropped element or override, `debug` for a member whose
  type resolves to nothing), and nothing is written into the system model,
  which has no slot for them.

## 11. Relations derived from invocations

The old scanner derived three relations between elements:

| Old relation                     | How it was found                                                                                                                                                                                                                                                                | Home in the system model                                                                                  |
| -------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| `DomainObject.UsesObject`        | The types of a type's fields and properties, generic arguments walked, arrays unwrapped; the source is the type and every base type and interface that is a domain object                                                                                                       | `ScannedBuildingBlock.properties` (sections 5, 7)                                                         |
| `DomainBehavior.UsesObject`      | The parameter, return and constraint types of the behaviour's method, and of every method it calls                                                                                                                                                                              | `input` and `output` (section 9) for the method's own signature; the called methods' signatures have none |
| `DomainBehavior.InvokesBehavior` | From a method call: the caller resolved to its behaviours (the method, its base methods and the interface members it implements), the callee to a behaviour; a callee that is no behaviour is walked through its own outgoing calls, transitively, until behaviours are reached | `ScannedBehaviour.invokes` (added by this design, section 12)                                             |

- **R11.1 Source of a call.** An `INVOKES` edge whose `from` is a method
  is attributed to the behaviours of that method: the behaviour the method
  stands for or is an overload of, and the behaviours of every member it
  `OVERRIDES` or `IMPLEMENTS_MEMBER`, transitively (so a call inside
  `SqlOrderRepository.Save`, which is no block, counts for the interface
  behaviour `Order Repository.Save`). A call from a property or field
  initialiser is attributed to nothing.
- **R11.2 Target of a call.** The behaviours of the invoked method, found
  the same way (the method's own, then those of the members it overrides or
  implements). When it has none, the invoked method is a step: its own
  `INVOKES` edges are followed, each method visited once per walk, until
  methods with behaviours are reached. Steps may cross blocks and artifacts
  and pass through excluded types; the walk stops at stubs, at constructors
  and at methods with no outgoing calls.
- **R11.3 Shape.** `invokes: BehaviorId[]`, sorted, unique, never the
  behaviour itself.
- **R11.4 Creation.** `INVOKES` of a constructor is a use of the created
  block, not a call of a behaviour; the system model has no slot for it.

## 12. Decisions

Taken on the first draft of this document; the rules above are written to
them.

1. **Invocations** are in the system model: `ScannedBehaviour.invokes:
   BehaviorId[]` (default empty), filled by section 11. The design document's
   `DesignedBehaviour` does not carry it yet; the dummy scanner leaves it
   empty.
2. **Messages are value objects.** `Command`, `Query`, `Event`,
   `DddDomainEvent` and `ReadModel` become `value_object` blocks.
3. **No annotation inheritance.** Every block is annotated itself. The old
   scanner's walk over base types and interfaces is not implemented.
4. **Public methods only** are behaviours.
5. **Public members only** are properties, and in Java the fields a getter
   exposes (R5.8), since Java state sits behind getters, often Lombok's.
6. **The behaviour type comes from the annotation** (`EntryPoint`,
   `TriggeredBy`), never from the return type or the name. A behaviour
   without one is a `Command`, the one default this design takes on its own;
   it is written here so it can be changed in one place.
7. **Dictionaries are collections of key-value pairs.** The contract cannot
   say so (`BuildingBlockRef` is a block, a primitive or a collection of
   one); until it can, a dictionary resolves to nothing. Open: add a pair
   (`{ pairOf: [key, value] }` or a tuple) to `BuildingBlockRef`.
8. **Looking through unmapped generics** (R7.6) stays.
9. **Scenarios** are mapped by title only. `ScannedScenario` is relaxed for
   that: `description` nullable, `steps` may be empty. `DesignedScenario`
   keeps its steps.
10. **`[assembly: DomainModule]`** and a `DomainModule` without
    `ApplyOnNamespace` are ignored, without a log line.
11. **Running the first stage.** The C# adapter runs `noesis-scan-csharp`
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

**Where.** `server/backend/src/app/code-model/system-model-builder/`: the
system model builder, pure functions over the two contracts, in the app layer
because they are domain logic every parser's code model goes through.

| File                      | What                                                                                                         |
| ------------------------- | ------------------------------------------------------------------------------------------------------------ |
| `vocabulary.ts`           | The `AnnotationVocabulary` interface: roles by annotation id, primitives, collections, wrappers              |
| `csharp.vocabulary.ts`    | Section 2's C# table                                                                                         |
| `java.vocabulary.ts`      | The Java table                                                                                               |
| `annotations.ts`          | Reading an annotation's arguments: literals unquoted, `null` as absent, enum members                         |
| `code-model-index.ts`     | Per-artifact lookup of nodes, stubs and edges; cross-artifact resolution (section 8)                         |
| `namespace-config.ts`     | `NamespaceConfig` (moved from the C# adapter; the file reading stays in the adapter) and R6.1                |
| `type-resolution.ts`      | Section 7                                                                                                    |
| `build-system-model.ts`   | Sections 3 to 6, 9 to 11: `buildSystemModel(manifest, files, vocabulary, config) → { model, diagnostics }`   |
| `system-model-builder.ts` | `SystemModelBuilder`: picks the vocabulary by the manifest's language and builds over the namespace settings |

The scan itself is domain logic too: `SourceCodeScanner`
(`app/system-model/source-code-scanner.ts`) takes a `CodeParser`
(`app/code-model/code-parser.ts`) and a `SystemModelBuilder`, runs the parser,
builds the system model of what it read, reports the diagnostics through the
`ScanLog` port and returns the `SystemModel`. The adapters are only parsers:
`CSharpCodeParser` and `JavaCodeParser` (`adapters/out/parsers/`) run their
tool, and read and validate the files it wrote with the `code-model.ts` schemas.

**Tests.** `server/backend/test/unit/system-model-builder.spec.ts`: one
`describe` per section above, one `it` per rule, over a small builder that
makes a `CodeModelFile` in a few lines. `test/unit/csharp-code-parser.spec.ts`
scans the .NET scanner's golden code model of the fixture solution under
`scanners/dotnet/test/fixtures/` (`CSharpSyntax/Projection` holds the
annotated types; `scanners/dotnet/test/Noesis.Scanner.Tests/golden/` is
regenerated with `NOESIS_UPDATE_GOLDEN=1 dotnet test`) and checks the whole
chain without .NET. `test/e2e-toolchain/csharp-scanner.e2e.spec.ts` builds the .NET
scanner, scans the same fixture through the parser and asserts the model
and the time each stage took. The expected `invokes` of every chain in the
fixture are in `test/support/csharp-fixture-expectations.ts`, shared by both.
