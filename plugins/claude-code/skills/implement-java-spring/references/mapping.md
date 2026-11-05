# From the design document to Java

How each element of a design document becomes Java that the Noesis Java
scanner reads back as the same element. The scanner works on compiled
classes:

- a **module** is a package;
- a **building block** is a type annotated with one of the
  `vision.noesis.annotations` stereotypes;
- a **message** is a type annotated `@Command`, `@Query` or `@Event`;
- a **behavior** is a public, non-synthetic method of a building block.
  An application service's behavior also carries `@CommandHandler`,
  `@QueryHandler` or `@EventHandler` after the kind of message it takes;
  no other building block's does. A behavior has no type of its own: the
  annotation only marks it.

An application service's behavior handles each message of its own kind it
takes as a parameter (an `@EventHandler` handles an event, not a command).
Any behavior sends each message it constructs.

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

| `type`                 | Java shape                                                          | Annotation                                                            |
| ---------------------- | ------------------------------------------------------------------- | --------------------------------------------------------------------- |
| `aggregate`            | `public final class`, the aggregate root                            | `@AggregateRoot`                                                      |
| `entity`               | `final class`, package-private when only its aggregate uses it      | `@DomainEntity`                                                       |
| `value_object`         | `public record`; an `enum` for a closed set of values (below)       | `@ValueObject`, or `@Identifier` (below)                              |
| — an identifier        | `public record` with one component                                  | `@Identifier`                                                         |
| `command`              | `public record`                                                     | `@Command`                                                            |
| `query`                | `public record`                                                     | `@Query`                                                              |
| `event`                | `public record`                                                     | `@Event`                                                              |
| `domain_service`       | `public final class`, or a `@FunctionalInterface` for one decision  | `@DomainService`                                                      |
| `application_service`  | `public class` with constructor-injected collaborators              | `@ApplicationService`                                                 |
| `repository`           | `public interface`                                                  | `@Repository`                                                         |
| `factory`              | `public final class`                                                | `@Factory`                                                            |
| `external_integration` | `public interface`, the port; never its implementation              | `@ExternalIntegration(Direction.SECONDARY)`                           |
| `in_adapter`           | `public class` that calls application services                      | `@Adapter(Direction.PRIMARY)`                                         |
| `out_adapter`          | `public class` implementing the port it stands behind               | `@Adapter(Direction.SECONDARY)`                                       |
| `technical_service`    | `public interface`, or `java.time.Clock` and the like when one fits | `@TechnicalService`; a JDK or library type through a library manifest |

A design document written before it could type messages types them as
`value_object`; one written since types them `command`, `query` or
`event`. Tell an older document's apart by their definition and their use:

- **Identifier**: the type of an `id` property, or named `<Something>Id`
  with a single `value` property (`QDocId`, `UserId`).
- **Command**: the definition calls it a command or a request to change
  something, it is named in the imperative, and a behavior takes it as
  input to change state (`CreateQDoc`).
- **Query**: a request to read, taken as input by a behavior that only
  reads.
- **Event**: the definition calls it an event or says what happened, it is
  named in the past tense, and a behavior outputs it or reacts to it
  (`QDocCreated`).
- **Enum**: a value object with one `has_state` named `value` whose
  definition, or a `validation` rule on a behavior that takes it, names a
  closed set of values ("takes exactly one of two values: active,
  archived") is an `enum` with one constant per value, in upper snake case
  (`ACTIVE`, `ARCHIVED`).

An external integration is `Direction.SECONDARY`, a port the domain calls,
unless its definition says the outside world calls the domain through it;
then it is `PRIMARY`.

Annotate exactly one stereotype per type. Types the design document does
not name carry none: exceptions, test doubles, test data builders. Only
an application service's behaviors carry a handler annotation: never a
method of another building block, and never a method that is not a
behavior (package-private helpers, accessors, `equals`).

### `extends`

A base building block that others reach with an `extends` relation is a
Java interface carrying the base's own annotation; each extender
`implements` it. Make it `sealed ... permits` when all extenders live in one
package.

### Javadoc

A type's Javadoc is its building block's definition. An aggregate's Javadoc
adds the invariants it protects, one line per rule its behaviors govern. Write
them in the dominant language of the design document; do not translate.

## State

Each `has_state` relation from a block is a record component or a
`private final` field (a plain `private` field when a behavior changes it),
named exactly as the relation's `name` and typed by its `to`.

Each `has_collaborator` relation from a block is a `private final` field
typed by its `to`, handed in through the constructor under the relation's
`name`: the scanner reads a collaborator from the constructor's parameter
of that name.

| Design document `to`  | Java type                                                            |
| --------------------- | -------------------------------------------------------------------- |
| `primitive\|string`   | `String`                                                             |
| `primitive\|integer`  | `int` (`long` when the definition says counts grow past two billion) |
| `primitive\|decimal`  | `BigDecimal`, never `double`                                         |
| `primitive\|boolean`  | `boolean`                                                            |
| `primitive\|date`     | `LocalDate`                                                          |
| `primitive\|datetime` | `Instant`                                                            |
| `primitive\|duration` | `Duration`                                                           |
| `primitive\|uuid`     | `UUID`                                                               |
| `building_block\|…`   | the type of that building block                                      |

The relation's `cardinality` wraps the type: `1` is the type itself,
checked with `Objects.requireNonNull` on construction; `0..1` may be `null`
in its field or component, and where a class exposes it the accessor
returns `Optional<T>`; `*` is a `List<T>`, held as an unmodifiable copy.

A property typed with another aggregate breaks the aggregate rules
([building blocks](building-blocks.md#aggregates)): hold that aggregate's
identifier instead, and report it as a deviation.

## Behaviors

A behavior `behavior|qdocmanagement.preparation.QDoc.create` is the public
method `create` of the type `QDoc`.

- **Name**: the behavior's name, verbatim. One name, one behavior: Java
  overloads of it are the same behavior.
- **Parameters**: the `has_input` relations of the behavior in the order of
  their `position`, named as the relations, typed by their `to` and
  `cardinality` as in [State](#state).
  A `0..1` input that comes last is left out of an overload without it; one
  that does not come last is a parameter that may be `null`, and its
  Javadoc says so. Spring Boot's parent POM compiles with `-parameters`,
  which keeps the names in the bytecode the scanner reads; keep it that
  way.
- **Return type**: `void` without a `has_output`; the output's `to` with
  one; `Optional<T>` for a `0..1` output, `List<T>` for `*`.
  Several outputs need a base building block they all extend, which is
  then the return type; without one, ask the user.
- **Static or instance**: a behavior of a block whose output is that same
  block creates it, so it is a `public static` factory method
  (`Version.createFirst(...)` returns a `Version`). Every other behavior
  is an instance method.
- **Handler**: on an application service, the method carries the handler
  annotation of the message it takes — `@CommandHandler` for a `command`,
  `@QueryHandler` for a `query`, `@EventHandler` for an `event` — and
  every overload of the behavior carries the same one; one that takes no
  message is a `@CommandHandler` when it changes state, a `@QueryHandler`
  when it only reads. On any other building block the method has no
  handler annotation.
- **Interfaces**: on a repository or an external integration, the
  behavior is an abstract method, unannotated; no implementation is in
  scope.
- **Actors and manual processes**: who calls a behavior is no part of it;
  the design's manual processes invoke it and its actors perform them.
  Every behavior is a `public` method, because the scanner sees only
  public methods. A use case's actors — those performing a manual process
  that invokes it — are each an `@Actor("<actor name>")` on its method,
  the name verbatim; the scan makes them actors of the model.
- **Javadoc**: the behavior's definition; `@param` for each input, saying
  what the block it is typed with is for here; `@return` with the output's.

### When the signature cannot be written as given

Keep the name and the inputs, choose the closest signature that compiles,
and report the deviation. The common case is a static creation behavior
whose design document output is an event rather than the block it creates
(`QDoc.create(command, documentNumber)` outputting `QDocCreated`): it
returns the new aggregate, which records the event for the application
service to take ([building blocks](building-blocks.md#domain-events)). Ask
the user first when the closest signature changes what a caller can do.

## The public surface

The scanner turns every public method of an annotated type into a
behavior. So an annotated type's public methods are its behaviors and
nothing else. What Java writes itself the scanner skips: record accessors,
`equals`, `hashCode`, `toString`, and an enum's `values` and `valueOf`.

- Accessors of an aggregate or an entity are package-private. The steps
  classes of its scenarios sit in the same package and read them; other
  code asks through a behavior.
- A helper another type calls (`pullEvents`, `newId`) is package-private,
  and its caller lives in the same package.
- A helper that must be public to be reached from another package is a
  behavior the design document is missing. Ask the user.
- Constructors are not behaviors. A record's canonical constructor is
  public; a class's constructor is package-private or private when a static
  factory creates it.

## Rules

A rule is enforced by the behaviors that govern it (the `from` of the
`governs` relations to it), in the place its `kind` says:

| `kind`          | Where it lives                                                                                                                                              |
| --------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `validation`    | the compact constructor of the value object the behavior takes, or the closed set of an enum, for one value's shape; else a guard at the behavior's start   |
| `state_change`  | a guard at the start of the behavior it gates, on the aggregate or entity whose state moves                                                                 |
| `post`          | the end of the behavior: the state it leaves, the event it returns or publishes                                                                             |
| `computation`   | a pure method of a value object or a domain service, exact in its units, precision and rounding                                                             |
| `coordination`  | the application service's behavior: the order of its calls, what it saves and publishes in one transaction                                                  |
| `configuration` | a value the behavior is given, never a literal: a constructor parameter of the service or policy that applies it; reading the setting is the adapters' work |

An invariant several behaviors govern is checked by each of them, and on
creation.

A rule governed by an application service's behavior is either orchestration
(an authorization check through an external integration, saving and
publishing in one transaction), which the application service does, or a
domain invariant, which the domain enforces and the application service only
triggers. A broken rule throws the exception named after it
([building blocks](building-blocks.md#rejections-and-exceptions)).

A technical constraint stated in a description (a timeout, a latency) is
not domain code. Leave it to the adapters and report it.

## Modified and removed elements

- **Modified**: only the fields with `"changed": true` change. A new
  definition replaces the Javadoc; a rule or scenario is added, changed or
  removed in the code and its feature file, a rule's `Rule:` and a
  scenario's `Scenario:` found by name; so is a relation — a field for a
  `has_state`, a constructor-injected field for a `has_collaborator`, a
  parameter for a `has_input`, a return type for a
  `has_output`, an interface for an `extends`. A changed `extends` is one
  relation removed and one added.
- **Removed**: delete the type or the method, every use of it, and the
  scenarios whose `When` steps call it, with their step definitions. A removed building block takes its behaviors and
  relations with it.
- **Renamed**: a removal and an addition. Rename the type or the method,
  its file and the step definitions that call it, and every reference to
  it.
