# Design: the code model as the only contract between scanner and projection

Status: proposed (October 2026).

Today a scan has two contracts. The first is the **code model**: the files a
scanner writes (`scanners/code-model/`, designed in
[`code-model-and-roslyn-csharp-scanner.md`](code-model-and-roslyn-csharp-scanner.md)).
The second is an **annotation vocabulary** per language, in the service
(`server/backend/src/app/code-model/projection/{java,csharp}.vocabulary.ts`),
plus a few rules of the projection that read one language's facts
([`code-model-to-system-model.md`](code-model-to-system-model.md), the
"projection rules" below). Whenever a scanner learns something about its
language, the second contract has to follow: the getter rule for Lombok
(R5.8) is the latest case, and vavr's `List` would be the next (it is not a
collection until `java.vocabulary.ts` lists it).

This document moves everything a language knows into the code model, so the
projection reads only language-neutral facts and has no table and no branch
per language. A new language is then a new scanner; a scanner that learns
more about its language changes its own output and nothing in the service.

## 1. What the projection knows about languages today

| Knowledge                                                        | Where                                                         | Projection rules       |
| ---------------------------------------------------------------- | ------------------------------------------------------------- | ---------------------- |
| Which annotation means which role (aggregate, behaviour, actor…) | `roles`, `arguments` of each vocabulary                       | section 2, R4, R9.2    |
| Which types are the model's primitives                           | `primitives` (keywords and platform type ids)                 | R7.2                   |
| Which types are collections, dictionaries, wrappers, optional    | `collections`, `dictionaries`, `wrappers`, `optionalWrappers` | R7.1, R7.3             |
| Which types mean no value                                        | `voidTypes`                                                   | R7.1, R9.7             |
| Which methods are never behaviours (`equals`, `ToString`…)       | `technicalMembers`                                            | R9.1                   |
| A Java record's components are properties, their accessors not   | the bag key `java.isRecordComponent`, read in the projection  | R5.7, R9.1             |
| A Java field behind a getter is a property, the getter not       | `language === 'java'` and `T:java.lang.Boolean` in the code   | R5.8, R9.1             |
| A C# event is no property                                        | `PropertyNode.accessors` `add`/`remove`                       | R5.1 (already neutral) |

Only the first row is about Noesis; every other row is a fact about the
language or its platform, which the scanner knows better than any table:
it has the compiler's symbols, the type hierarchy and the build's classpath.

## 2. Principle

The projection reads **what a declaration is**, never **what it is called**.
Every fact it needs is a field of the code model with a value from a closed,
language-neutral set; no projection rule names a language, a type id, a
member name or a bag key. The scanner owns the mapping from its language to
those values, and a test fails when the projection's sources mention a
language (section 7).

What stays in the projection is what Noesis means by a system model: which
declarations become modules, building blocks and behaviours, how overloads
collapse (R9.3), how a type parameter resolves through its constraint (R7.5),
how an unmapped generic is looked through (R7.6), how roles are inherited
along `OVERRIDES` and `IMPLEMENTS_MEMBER` (R9.2), and the repository's
`namespacePartsToSkip` and `namespacesToExclude`, which are the user's
configuration and not the scanner's knowledge.

## 3. Changes to the code model

Schema version 2; every change is additive except that the projection
requires the new fields.

### 3.1 Well-known types: `wellKnown`

A type the model has a word for carries it, on the type node or stub that
declares it and on a primitive type reference:

```ts
WellKnownType =
  | 'string' | 'integer' | 'decimal' | 'boolean'           // the model's primitives
  | 'date' | 'datetime' | 'duration' | 'uuid'
  | 'collection'      // element: the first type argument
  | 'dictionary'      // key, value: the first two type arguments
  | 'async'           // looked through to its first type argument (Task<T>, CompletableFuture<T>)
  | 'optional'        // looked through, marks optional (Nullable<T>, Optional<T>)
  | 'void'            // no value (void, Task, Void)
  | 'object'          // the root type: resolves to nothing

TypeNode.wellKnown: WellKnownType | null
StubNode.wellKnown: WellKnownType | null          // type stubs only
TypeRef primitive: { kind: 'primitive', name, nullable, wellKnown: WellKnownType | null }
```

R7.1 to R7.3 then read `wellKnown` of the referenced type and nothing else;
`primitives`, `collections`, `dictionaries`, `wrappers`, `optionalWrappers`
and `voidTypes` leave the vocabulary.

The scanner classifies with what it knows. The Java scanner moves today's
table into `scanners/java/core` and adds the hierarchy: a generic type whose
first type parameter flows into `java.lang.Iterable<T>` is a `collection`, one
that flows into `java.util.Map<K,V>` a `dictionary`. vavr's `List`, Guava's
`ImmutableList` and a project's own `Items<T> implements Iterable<T>` are
collections without a table entry. The .NET scanner does the same with
`IEnumerable<T>` and `IDictionary<K,V>`, and keeps its list of value types
(`Guid`, `DateOnly`, NodaTime's) as its own table. A type the scanner cannot
place is `null`, and the projection treats it as a plain named type, as it
treats an unlisted type today.

A scanned type may be well-known too (a project's own collection class); a
`collection` whose element is not its first type argument (`class Items
implements Iterable<Item>`) is a later refinement, with an explicit element
type on the classification.

### 3.2 Technical members: `wellKnown` on members

A member stub or method node may carry `wellKnown: 'technical'`: the root
type's members (`Object.equals`, `hashCode`, `toString`, `System.Object`'s
`Equals`, `GetHashCode`, `ToString`, `Finalize`, `MemberwiseClone`), and the
equality, comparison and cloning contracts (`Comparable.compareTo`,
`IEquatable<T>.Equals`, `IComparable<T>.CompareTo`, `ICloneable.Clone`).

R9.1 becomes: a method is technical when it is classified so, or when it
`OVERRIDES` or `IMPLEMENTS_MEMBER` a member that is. The edges exist today in
both scanners (the .NET golden has 78 overrides of `System.Object` members
and 183 implementations of `System.*` interface members). A method the
language makes technical without overriding anything (C#'s `Deconstruct`,
`PrintMembers`) is classified on its own node by the scanner.

Not every member of a platform type is technical: a domain class that
implements `Function<Order, Money>` has a behaviour `apply`. The scanner
classifies the members above, not every platform member, so that stays a
behaviour, as today.

### 3.3 Properties: Java property nodes, and `accessorOf`

The code model already has `PropertyNode` (`P:`), which the .NET scanner
writes for every C# property. The Java scanner writes one too, for:

- each record component: `P:pkg.Point.x`, accessors `['get']`;
- each instance field that a getter exposes, by today's R5.8 test (a public,
  non-static, parameterless `getX`, `isX` for a `boolean` or `Boolean`, or
  the fluent `x`, returning exactly the field's type), with `'set'` among its
  accessors when a matching public setter exists.

The property takes the field's type, documentation (else the getter's),
location and annotations, the getter's visibility and the getter's origin
(`generated` for Lombok's). The type `CONTAINS` it. The field stays as it is,
private, and is not a property candidate (R5.1); R5.2 (one name, one
property) merges nothing new, since the field is no candidate.

Each accessor method gets a link to its property:

```ts
MethodNode.accessorOf: NodeId | null     // the P: id of the property it reads or writes
```

R9.1 then excludes a method whose `accessorOf` is set, unless a `behaviour`
role says otherwise, which replaces both R5.7 and R5.8 and removes the read
of `java.isRecordComponent` (the scanner may keep the bag key for its own
readers). C# accessors are not method nodes, so `accessorOf` stays `null`
there.

In the Java scanner this is one pass in `core` over the declarations, after
the engine has written them, so the source, bytecode and hybrid engines all
emit the same properties, and the engine agreement test covers them. Lombok's
getters become properties in the hybrid and bytecode engines because their
methods are in the model; the source engine sees them only for hand-written
getters, as today.

### 3.4 Roles: `Annotation.role`

The scanner writes the meaning of a Noesis annotation onto the annotation:

```ts
Annotation.role: AnnotationRole | null

AnnotationRole =
  | { role: 'buildingBlock', type: BuildingBlockType, name: string | null }
  | { role: 'behaviour', type: BehaviourType | null, name: string | null }
  | { role: 'actor', name: string }
  | { role: 'description', text: string }
  | { role: 'scenario', name: string }
  | { role: 'exclude' }
```

The arguments a role reads (`name`, `TriggeredBy`, `markdownText`) are
resolved by the scanner into the role's fields, so `arguments` leaves the
vocabulary too; the annotation's own arguments stay for whoever reads them.
Java's `@QueryHandler` fixing the behaviour's type (R9.4) is a role with a
`type`, written by the scanner. R9.2 (a role on the member overridden or
implemented names the behaviour too) keeps working, because roles travel with
the annotations on every node.

Where the scanner takes the table from is a choice, in two steps:

1. **First, the scanner's own table.** The Java table moves from
   `java.vocabulary.ts` into `scanners/java/core`, the C# table into
   `scanners/dotnet`. The annotation libraries ship with their scanners
   (`scanners/java/annotations`, `NoesisVision.Annotations`), so a scanner
   that knows its library is no new coupling.
2. **Then, meta-annotations.** Each annotation library marks its own
   annotations with one meta-annotation, `@NoesisRole(BUILDING_BLOCK, type =
"aggregate")` on `@AggregateRoot`, `[NoesisRole(...)]` on
   `DddAggregateAttribute`, and the scanner reads that meta-annotation instead
   of a table: from the annotation type's node, or, for a library, from its
   class file or metadata. A team can then mark its own annotations
   (`@OrderAggregate`) without a change to Noesis. The code model is the same
   in both steps; only where the scanner reads the meaning changes.

## 4. The projection after the change

| Rule             | Today                                                                | After                                                   |
| ---------------- | -------------------------------------------------------------------- | ------------------------------------------------------- |
| section 2        | annotation id → role, by vocabulary                                  | `Annotation.role`                                       |
| R5.1, R5.7, R5.8 | public field or property, record component bag, getter rule for Java | public property or field; Java's are properties already |
| R5.6             | the field's documentation, else its getter's                         | the property's documentation, which the scanner chose   |
| R7.1–R7.3        | id lists per language                                                | `wellKnown` of the referenced type                      |
| R9.1             | technical names per language, getter and record exclusions           | `wellKnown: 'technical'` along overrides, `accessorOf`  |
| R9.4             | `TriggeredBy` argument, or the vocabulary's fixed type               | `role.type`                                             |

`vocabulary.ts`, `java.vocabulary.ts` and `csharp.vocabulary.ts` are deleted,
and with them `vocabularyOf(language)` in `code-model-scanner.ts`: any
manifest language is projected, so a scanner for a third language needs no
change in the service.

## 5. What the scanners do

| Scanner                  | 3.1 well-known types                                                       | 3.2 technical members                                                                                     | 3.3 properties                       | 3.4 roles                         |
| ------------------------ | -------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- | ------------------------------------ | --------------------------------- |
| Java (`scanners/java`)   | table from `java.vocabulary.ts`, plus hierarchy, in one shared `core` pass | `Object`'s members, `Comparable`                                                                          | new: one `core` pass for all engines | table from `java.vocabulary.ts`   |
| .NET (`scanners/dotnet`) | table from `csharp.vocabulary.ts`, plus hierarchy                          | `System.Object`'s members, `IEquatable<T>`, `IComparable<T>`, `ICloneable`, `Deconstruct`, `PrintMembers` | nothing: properties are native       | table from `csharp.vocabulary.ts` |
| Any `code-model` tool    | optional: an unclassified type is a named type                             | optional                                                                                                  | optional                             | required for building blocks      |

A third-party tool that writes no roles yields an empty system model, which
is honest: without roles nothing says what is a building block.

## 6. Migration

One pull request per step; each removes one row of section 1 from the
projection and keeps the system models of the fixtures and examples equal,
which the goldens show.

1. **Schema 2** in `server/backend/src/app/code-model/code-model.ts` (the
   zod schema the JSON Schema in `scanners/code-model/` is generated from),
   in the Java model records and the .NET model, with every new field
   nullable, so both scanners write version 2 before they fill it.
2. **Technical members** (3.2): both scanners classify; R9.1 reads the
   classification; `technicalMembers` goes.
3. **Java properties** (3.3): the `core` pass; R5.7 and R5.8 go; the shop
   fixture's `OrderLine.product` and the discounts example keep their
   properties, now from property nodes.
4. **Well-known types** (3.1): both scanners classify; R7.1 to R7.3 read
   `wellKnown`; vavr's collections in `examples/discounts-java` become
   collections, the one intended change in the goldens.
5. **Roles** (3.4, first step): both scanners resolve roles; the projection
   reads `Annotation.role`; the vocabulary files go. `projectSystemModel`
   loses its `vocabulary` argument.
6. **Meta-annotations** (3.4, second step), when the annotation libraries
   can carry them: no change to the code model or the service.

The committed code models the service's tests read
(`server/backend/test/fixtures/{java,csharp}/shop/code-model/`) are
regenerated at each step with their scanners. Code models are written per
scan into the session directory and never stored, so no stored data needs
migrating; the projection refuses a version 1 file with a message that names
the scanner to update.

## 7. Tests

- **The projection names no language.** A unit test reads the sources under
  `server/backend/src/app/code-model/projection/` and fails on `java`,
  `csharp`, a `T:`/`M:` id literal or a `languageSpecific` key; it is the
  guard that keeps section 2 true.
- **Projection rules on neutral facts.** `code-model-projection.spec.ts`
  builds its inputs with `wellKnown`, `role` and `accessorOf` directly, with
  no language and no vocabulary; one test per rule, as now.
- **Scanner facts.** The Java `*FactsTest` classes and the .NET tests pin
  the classifications, property nodes and roles of the syntax fixtures; the
  Java engine agreement test compares them across engines.
- **End to end.** The shop fixtures and `examples/discounts-java` keep the
  same system model, except where a step says otherwise.

## 8. Open questions

1. **Element of a non-generic collection.** `class Items implements
Iterable<Item>` is a collection of `Item`; carrying the element on the
   classification (`{ wellKnown: 'collection', element: TypeRef }`) is the
   general form. Deferred until a codebase needs it.
2. **Dictionaries** stay unexpressible in the system model (decision 7 of the
   projection document); `wellKnown: 'dictionary'` only makes that explicit.
3. **The C# annotation library** is a NuGet package outside this repository;
   the meta-annotation step needs a release of it, which is why it comes
   last and is optional.
4. **Partial facts from third-party tools.** Whether the projection should
   fall back to anything when a tool writes no roles, or report an empty
   model with a diagnostic, is decided in step 5.
