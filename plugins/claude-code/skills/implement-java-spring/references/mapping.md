# From the design document to Java

How each element of a design document becomes Java that the Noesis Java
scanner reads back as the same element. The scanner works on compiled
classes:

- a **module** is a package;
- a **building block** is a type annotated with one of the
  `vision.noesis.annotations` stereotypes;
- a **message** is a type annotated `@Command`, `@Query` or `@Event`;
- a **behaviour** is a public, non-synthetic method of a building block.
  An application service's behaviour also carries `@CommandHandler`,
  `@QueryHandler` or `@EventHandler` after the behaviour's type; no other
  building block's does.

An application service's behaviour handles each message of its own kind it
takes as a parameter (an `@EventHandler` handles an event, not a command).
Any behaviour sends each message it constructs.

Handler annotations stay on application services so that every command and
query has one handler, the use case's entry point. An aggregate method that
takes the same command (`QDoc.create(CreateQDoc command, …)`) works on it
but does not handle it.

So names, packages, annotations and the public surface are the contract
with the next scan. Everything below follows from that.

## Modules and packages

A module id spells a path: `module|qdocmanagement.preparation` is the
module `preparation` inside the root module `qdocmanagement`. Each segment
is one package level.

1. **Find the root module's package.** For a root module the system model
   has, take the package from the `source.path` of its module or of any of
   its building blocks. For a new root module, take the package of the
   `@SpringBootApplication` class: when its last segment is the root
   module's name (`com.example.qdocmanagement` for `qdocmanagement`), it is
   the root module's package; otherwise the root module's package is that
   package plus the root module's name.
2. **Append the rest of the path**:
   `module|qdocmanagement.preparation` is
   `com.example.qdocmanagement.preparation`.
3. **Make each segment a valid package name**: lower case, letters and
   digits only. A module `credit-notes` lives in `creditnotes`. Report such a
   rename: the scanner names a module after its package.
4. **Annotate every module**, the root included, in its
   `package-info.java`, with the module's name verbatim and its definition
   as Javadoc:

```java
/**
 * Everything that happens to a QDoc from its creation until its first
 * version is shared for review.
 */
@Module("preparation")
package com.example.qdocmanagement.preparation;

import vision.noesis.annotations.Module;
```

Never add packages for technical roles (`domain`, `application`, `model`,
`service`, `port`, `impl`) inside a module: the scanner would read each as
a module of its own. The role of a type is carried by its annotation, and a
building block lives directly in the package of its module.

## Building blocks

A building block `building_block|qdocmanagement.preparation.QDoc` is the
type `QDoc` in the package of `module|qdocmanagement.preparation`, in
`src/main/java/<package as path>/QDoc.java`. The type name is the building
block's name, verbatim. The design document's `type` picks the shape and
the annotation:

| `type`                 | Java shape                                                         | Annotation                                  |
| ---------------------- | ------------------------------------------------------------------ | ------------------------------------------- |
| `aggregate`            | `public final class`, the aggregate root                           | `@AggregateRoot`                            |
| `entity`               | `final class`, package-private when only its aggregate uses it     | `@DomainEntity`                             |
| `value_object`         | `public record`; an `enum` for a closed set of values (below)      | `@ValueObject`, or one of the three below   |
| — an identifier        | `public record` with one component                                 | `@Identifier`                               |
| — a command or a query | `public record`                                                    | `@Command` or `@Query`                      |
| — an event             | `public record`                                                    | `@Event`                                    |
| `domain_service`       | `public final class`, or a `@FunctionalInterface` for one decision | `@DomainService`                            |
| `application_service`  | `public class` with constructor-injected collaborators             | `@ApplicationService`                       |
| `repository`           | `public interface`                                                 | `@Repository`                               |
| `factory`              | `public final class`                                               | `@Factory`                                  |
| `external_integration` | `public interface`, the port; never its implementation             | `@ExternalIntegration(Direction.SECONDARY)` |

A design document types messages and identifiers as `value_object`. Tell
them apart by their definition and their use:

- **Identifier**: the type of an `id` property, or named `<Something>Id`
  with a single `value` property (`QDocId`, `UserId`).
- **Command**: the definition calls it a command or a request to change
  something, it is named in the imperative, and a `Command` behaviour takes
  it as input (`CreateQDoc`).
- **Query**: a request to read, taken as input by a `Query` behaviour.
- **Event**: the definition calls it an event or says what happened, it is
  named in the past tense, and a behaviour outputs it or an `Event`
  behaviour takes it as input (`QDocCreated`).
- **Enum**: a value object with one `value` property whose `Structure`
  rule names a closed set of values ("takes exactly one of two values:
  active, archived") is an `enum` with one constant per value, in upper
  snake case (`ACTIVE`, `ARCHIVED`).

An external integration is `Direction.SECONDARY`, a port the domain calls,
unless its definition says the outside world calls the domain through it;
then it is `PRIMARY`.

Annotate exactly one stereotype per type. Types the design document does
not name carry none: exceptions, test doubles, test data builders. Only
an application service's behaviours carry a handler annotation: never a
method of another building block, and never a method that is not a
behaviour (package-private helpers, accessors, `equals`).

### `implements`

A base building block that others list in `implements` is a Java interface
carrying the base's own annotation; each implementer `implements` it. Make
it `sealed ... permits` when all implementers live in one package.

### Javadoc

A type's Javadoc is its building block's definition. An aggregate's Javadoc
adds the invariants it protects, one line per rule attached to it. Write
them in the dominant language of the design document; do not translate.

## Properties

Each property is a record component or a `private final` field (a plain
`private` field when a behaviour changes it), named exactly as the property.

| Design document type    | Java type                                                            |
| ----------------------- | -------------------------------------------------------------------- |
| `primitive\|string`     | `String`                                                             |
| `primitive\|integer`    | `int` (`long` when the definition says counts grow past two billion) |
| `primitive\|decimal`    | `BigDecimal`, never `double`                                         |
| `primitive\|boolean`    | `boolean`                                                            |
| `primitive\|date`       | `LocalDate`                                                          |
| `primitive\|datetime`   | `Instant`                                                            |
| `primitive\|duration`   | `Duration`                                                           |
| `primitive\|uuid`       | `UUID`                                                               |
| `building_block\|…`     | the type of that building block                                      |
| `{ "collectionOf": T }` | `List<T>`, held as an unmodifiable copy                              |

An `optional` property may be `null` in its field or component. Every other
one is checked with `Objects.requireNonNull` on construction. Where a class
exposes an optional property, the accessor returns `Optional<T>`.

A property typed with another aggregate breaks the aggregate rules
([building blocks](building-blocks.md#aggregates)): hold that aggregate's
identifier instead, and report it as a deviation.

## Behaviours

A behaviour `behavior|qdocmanagement.preparation.QDoc.create` is the public
method `create` of the type `QDoc`.

- **Name**: the behaviour's name, verbatim. One name, one behaviour: Java
  overloads of it are the same behaviour.
- **Parameters**: the inputs, in their order, named as the inputs, typed
  as in [Properties](#properties). An optional input that comes last is
  left out of an overload without it; one that does not come last is a
  parameter that may be `null`, and its Javadoc says so. Spring Boot's
  parent POM compiles with `-parameters`, which keeps the names in the
  bytecode the scanner reads; keep it that way.
- **Return type**: `void` with no output; the output's type with one;
  `Optional<T>` for an optional output, `List<T>` for a collection. Several
  outputs need a base building block they all implement, which is then the
  return type; without one, ask the user.
- **Static or instance**: a behaviour of a block whose output is that same
  block creates it, so it is a `public static` factory method
  (`Version.createFirst(...)` returns a `Version`). Every other behaviour
  is an instance method.
- **Type**: a `Command` changes state, a `Query` only reads, and an
  `Event` reacts to an event, which it takes as its parameter. On an
  application service, the method carries the matching handler annotation,
  `@CommandHandler`, `@QueryHandler` or `@EventHandler`, and every overload
  of the behaviour carries the same one. On any other building block the
  type shapes the method but has no annotation.
- **Interfaces**: on a repository or an external integration, the
  behaviour is an abstract method, unannotated; no implementation is in
  scope.
- **Visibility and actors**: a behaviour's `visibility` (`public` with
  actors for a use case, `private` for the rest) is a design notion, not a
  Java one. Every behaviour is a `public` method, because the scanner sees
  only public methods. A use case's actors go in its Javadoc.
- **Javadoc**: the behaviour's definition; `@param` with each input's
  description; `@return` with the output's; `Actors:` for a use case.

### When the signature cannot be written as given

Keep the name and the inputs, choose the closest signature that compiles,
and report the deviation. The common case is a static creation behaviour
whose design document output is an event rather than the block it creates
(`QDoc.create(command, documentNumber)` outputting `QDocCreated`): it
returns the new aggregate, which records the event for the application
service to take ([building blocks](building-blocks.md#domain-events)). Ask
the user first when the closest signature changes what a caller can do.

## The public surface

The scanner turns every public method of an annotated type into a
behaviour. So an annotated type's public methods are its behaviours and
nothing else. What Java writes itself the scanner skips: record accessors,
`equals`, `hashCode`, `toString`, and an enum's `values` and `valueOf`.

- Accessors of an aggregate or an entity are package-private. Its tests sit
  in the same package and read them; other code asks through a behaviour.
- A helper another type calls (`pullEvents`, `newId`) is package-private,
  and its caller lives in the same package.
- A helper that must be public to be reached from another package is a
  behaviour the design document is missing. Ask the user.
- Constructors are not behaviours. A record's canonical constructor is
  public; a class's constructor is package-private or private when a static
  factory creates it.

## Rules

A rule is enforced in the element it is attached to:

| `ruleType`     | Where it lives                                                                                  |
| -------------- | ----------------------------------------------------------------------------------------------- |
| `Structure`    | the value object's compact constructor, or the closed set of an enum                            |
| `Consistency`  | the aggregate or entity: checked by every behaviour that could break it, and on creation        |
| `Computation`  | a pure method of a value object or a domain service, exact in its units, precision and rounding |
| `State change` | a guard at the start of the behaviour it gates                                                  |

A rule attached to an application service's behaviour is either orchestration
(an authorization check through an external integration, saving and
publishing in one transaction), which the application service does, or a
domain invariant, which the domain enforces and the application service only
triggers. A broken rule throws the exception named after it
([building blocks](building-blocks.md#rejections-and-exceptions)).

A technical constraint stated in a description (a timeout, a latency) is
not domain code. Leave it to the adapters and report it.

## Modified and removed elements

- **Modified**: only the fields with `"changed": true` change. A new
  definition replaces the Javadoc; a property, input, output, rule or
  scenario is added, changed or removed in the code and its tests. A
  changed `implements` entry is one removed and one added.
- **Removed**: delete the type or the method, every use of it, and the
  tests of its scenarios. A removed building block takes its behaviours
  with it.
- **Renamed**: a removal and an addition. Rename the type or the method,
  its file and its tests, and every reference to it.
