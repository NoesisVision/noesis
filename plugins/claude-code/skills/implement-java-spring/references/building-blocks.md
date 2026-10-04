# Implementing the building blocks

How to implement each building block type: the DDD tactical patterns in a
hexagonal, clean architecture on Java 21+ and Spring Boot 4. Distilled from
the reference projects most teams agree on (ddd-by-examples/library,
BuckPal, dddsample, IDDD samples, ddd-leaven, jMolecules) and narrowed to the
domain and its application services. [The mapping](mapping.md) decides
names, packages, annotations and signatures; this decides what goes inside.

**MUST** is non-negotiable, **SHOULD** is the default to deviate from only
with a reason you report.

## Architecture

- Dependencies point inward. Domain types know nothing of application
  services; application services know nothing of adapters.
- Domain types MUST NOT import `org.springframework..`,
  `jakarta.persistence..`, `jakarta.validation..`, Jackson
  (`com.fasterxml..`, `tools.jackson..`) or Lombok. The
  `vision.noesis.annotations` stereotypes carry no behaviour and are
  allowed everywhere.
- Application services MAY use Spring's `@Transactional` and nothing else
  from Spring: no `@Service`, `@Component` or `@Autowired`. They are wired
  in a `@Configuration` that comes with the adapters, not now.
- Packages follow the modules, which are domain concepts. Where the
  guidelines this distils separate `domain`, `application` and `adapter`
  packages, here the annotation carries the role: a module's package holds
  its aggregates, value objects, services and ports side by side.
- A type is package-private unless another package uses it.
- Names come from the ubiquitous language, as the design document gives
  them. No pattern suffixes (`OrderEntity`, `MoneyVO`, `OrderAggregate`);
  the annotation says the pattern. Exceptions end in `Exception`.
- Time comes from an injected `java.time.Clock`, read only by application
  services and passed into the domain as an `Instant`. Domain code never
  calls `Instant.now()`, `LocalDate.now()` or `UUID.randomUUID()` outside
  an identifier's `newId()`.
- No Lombok, no `double` or `float` for money or quantities, no `null`
  returned where an `Optional` or an empty list says it better.

## Value objects

The most numerous building blocks. A concept defined by its attributes, not
by an identity.

1. MUST be immutable: a `record`, or a `final` class with `final` fields.
2. MUST validate itself in the compact constructor and throw a domain
   exception. An instance that exists is valid.
3. Equality by value, which a record gives for free. A value object never
   has an id.
4. SHOULD expose behaviour, not only data: `Money.add(Money)`,
   `DateRange.overlaps(DateRange)`. An operation returns a new instance.
   Only behaviours the design document names are public.
5. SHOULD offer named static factories for other constructions
   (`Money.zero(currency)`), package-private unless the design names them.
6. A collection component is copied with `List.copyOf` in the compact
   constructor.
7. MAY refer to other value objects, never to an entity or an aggregate.

```java
/** The title of a QDoc. */
@ValueObject
public record QDocTitle(String value) {

    public QDocTitle {
        Objects.requireNonNull(value, "value");
        if (value.isBlank()) {
            throw new BlankQDocTitleException();
        }
    }
}
```

An identifier is a value object wrapping one `UUID` or `String`. A
generated one gets a package-private `newId()`:

```java
/** The identity of a QDoc. */
@Identifier
public record QDocId(UUID value) {

    public QDocId {
        Objects.requireNonNull(value, "value");
    }

    static QDocId newId() {
        return new QDocId(UUID.randomUUID());
    }
}
```

## Entities

An object with an identity and a lifecycle, reached only through its
aggregate root.

1. MUST be identified by an identifier value object, never a raw `UUID`,
   `Long` or `String`. The domain assigns it on creation, not a database.
2. `equals` and `hashCode` MUST use the identifier only.
3. MUST NOT have setters. State changes through methods named in the
   ubiquitous language (`assign`, not `setAssignee`).
4. Package-private when only its aggregate uses it; MUST be changed only
   through the aggregate root, and never handed out in a mutable form.
5. Accessors return immutable values: value objects, unmodifiable lists.
6. Distinct states with distinct allowed operations SHOULD be distinct
   types or a sealed interface over states; otherwise an enum with guards.

```java
/** A complete, self-contained edition of a QDoc, numbered from 1. */
@DomainEntity
final class Version {

    private final int number;
    private VersionStatus status;
    private final List<Assignment> assignments;

    private Version(int number, VersionStatus status, List<Assignment> assignments) { ... }

    public static Version createFirst(List<UserId> authors, List<UserId> reviewers, List<UserId> approvers) {
        if (authors.isEmpty()) {
            throw new VersionWithoutAuthorException();
        }
        return new Version(1, VersionStatus.NEW, assignmentsOf(authors, reviewers, approvers));
    }

    int number() { return number; }

    @Override public boolean equals(Object o) { return o instanceof Version other && number == other.number; }
    @Override public int hashCode() { return Integer.hashCode(number); }
}
```

## Aggregates

A consistency boundary: the smallest cluster whose invariants hold after
every command.

1. MUST protect a named invariant, listed in the root's Javadoc. Keep it
   small: a root and value objects by default, inner entities only when an
   invariant spans them.
2. MUST refer to other aggregates by identifier only (`UserId createdBy`),
   never by reference.
3. One transaction changes one aggregate. Other aggregates follow through
   events.
4. Only the root is public, and only the root has a repository.
5. A command behaviour checks its preconditions, changes state and returns
   what the design document says it outputs: `void`, an event, or a value.
   Never `this` for chaining.
6. MUST NOT call repositories, external integrations, clocks or random
   generators. It gets what it needs as arguments: an `Instant now`, a
   document number, a policy.
7. MUST carry a `private long version` for optimistic locking, owned by the
   domain and mapped by the persistence adapter later. It has no accessor
   until that adapter needs one.
8. Rehydration from storage (a `restore(...)`) comes with the persistence
   adapter, not now.
9. MUST be testable with plain JUnit: no Spring, no mocks.

```java
/**
 * A quality document: a package of files that always works as a whole.
 *
 * <p>Invariants: a QDoc keeps at least one version.
 */
@AggregateRoot
public final class QDoc {

    private final QDocId id;
    private final QDocTitle title;
    private QDocStatus status;
    private final List<Version> versions = new ArrayList<>();
    private final UserId createdBy;
    private final Instant createdAt;
    private long version;
    private final List<QDocCreated> events = new ArrayList<>();

    private QDoc(...) { ... }

    /** Creates a QDoc from a creation request, with its first version. */
    public static QDoc create(CreateQDoc command, DocumentNumber documentNumber, Instant now) {
        QDoc qdoc = new QDoc(QDocId.newId(), command.title(), ..., now);
        qdoc.versions.add(Version.createFirst(command.authors(), command.reviewers(), command.approvers()));
        qdoc.events.add(new QDocCreated(qdoc.id, ..., now));
        return qdoc;
    }

    QDocId id() { return id; }

    List<QDocCreated> pullEvents() {
        List<QDocCreated> pulled = List.copyOf(events);
        events.clear();
        return pulled;
    }
}
```

`now` is an extra parameter beside the design document's inputs only when
the aggregate stamps a time property the design names (`createdAt`).
Report it as a deviation.

## Domain events

An immutable fact, named in the past tense, about something that happened
inside one aggregate.

1. MUST be a `record` annotated `@Event`, carrying the aggregate's
   identifier, when it happened (`Instant occurredAt`, or the time property
   the design names) and the minimum its consumers need.
2. MUST be created by the aggregate in the behaviour that caused it, never
   by an application service.
3. When the aggregate's behaviour outputs the event in the design
   document, it returns it. Otherwise the aggregate records it in a list
   and the application service takes it through a package-private
   `pullEvents()` after saving.
4. The application service publishes it through the external integration
   the design document names for that (`PreparationEventPublisher`), in the
   same transaction as the save.
5. A handler of an event is an `Event` behaviour: an application service
   method annotated `@EventHandler` that takes the event record as its parameter.
   When it changes another aggregate it MUST be idempotent: handling the
   same event twice changes nothing the second time.

```java
/** Tells the quality managers about every new QDoc. */
@ApplicationService
public class NewQDocNotifier {

    /** Notifies every quality manager that a QDoc was created. */
    @EventHandler
    @Transactional
    public void onQDocCreated(QDocCreated event) { ... }
}
```

## Domain services

Domain logic that belongs to no single entity or value object, usually a
decision that needs several aggregates.

1. MUST be stateless, framework-free and named after a domain activity.
2. MUST NOT load or save aggregates. The application service passes them
   in; the domain service returns a decision or a value, or calls
   behaviours of the aggregates it was given.
3. MAY depend on an external integration interface when its input is
   outside knowledge (`ExchangeRates`).
4. A plain class taking its policies or collaborators in its constructor,
   or a `@FunctionalInterface` for a single decision.

## Policies and specifications

A rule that varies (by tier, country, configuration) or combines with
others is extracted into a type of its own. The design document models one
as a `domain_service` or a `value_object`; implement it as that.

1. A policy is a `@FunctionalInterface` named after the rule, with its
   variants as named constants or small classes.
2. MUST return an explicit outcome, never a bare `boolean`: an allowance or
   a rejection with its reason as a sealed interface, or a value object.
3. MUST be pure: no I/O, no clock, no repository. What it needs is passed
   in.
4. The aggregate gets policies as arguments or through its factory; it
   never looks them up.

## Factories

1. Default: a static method on the aggregate root named after the domain
   action, which the design document names as a behaviour of that block.
2. A separate factory class only when the design document has a `factory`
   building block, typically for creation that needs collaborators.
3. MUST return a fully valid aggregate and MUST NOT persist it.
4. Creation is not rehydration: a factory enforces creation rules and
   records the creation event.

## Repositories

1. One per aggregate root, as an interface in the aggregate's module.
2. Its methods are the behaviours the design document names, and only
   those. Domain types only in its signatures: no `Page`, `Pageable`,
   `Specification`, Spring Data or JPA type, and never
   `extends JpaRepository`.
3. When a method throws for a missing aggregate, the exception is
   `<Aggregate>NotFoundException`.
4. No implementation in production code now; tests use an in-memory one
   ([testing](testing.md#test-doubles)).

## External integrations

A port to another system or another bounded context: an interface in this
module's language, implemented by an adapter later.

1. Its methods are the behaviours the design document names, in domain
   types only. No vendor types, HTTP status codes or foreign DTOs.
2. Expected failures are outcomes the design document names; technical
   failures are the adapter's to translate.
3. No implementation in production code now; tests use a stub or a
   recording fake ([testing](testing.md#test-doubles)).

```java
/** Tells which users hold which roles. */
@ExternalIntegration(Direction.SECONDARY)
public interface IdentityProvider {

    /** Tells whether the user holds the quality manager role now. */
    boolean isQualityManager(UserId user);
}
```

## Application services

The entry point of the use cases: a public behaviour with actors, or one an
event triggers. Orchestration only, no business rules.

1. One class per `application_service` building block, one public method
   per behaviour, named as the design document names them. Each carries
   `@CommandHandler`, `@QueryHandler` or `@EventHandler` after the
   behaviour's type: application services are the only building blocks
   whose methods do.
2. Collaborators come through the constructor: repositories, external
   integrations, domain services, factories and a `Clock`. Fields are
   `private final`.
3. Each state-changing behaviour is the transaction boundary:
   `@Transactional` (`org.springframework.transaction.annotation`) on the
   method, `@Transactional(readOnly = true)` on a query, when
   `spring-tx` is on the classpath.
4. Follows the same flow every time, in the order the behaviour's diagram
   draws when it has one:
   1. check what is the application's to check: authorization through an
      external integration, idempotency;
   2. load the aggregates it needs;
   3. call one behaviour of one aggregate, through a domain service or a
      factory when the design says so;
   4. save that one aggregate;
   5. publish its events;
   6. return the small result the design document names, never an
      aggregate unless it is the output.
5. MUST NOT hold an `if` that encodes a business rule. An `if` for
   authorization or idempotency is fine.
6. MUST NOT call another application service.

```java
/** Creates QDocs on a quality manager's request. */
@ApplicationService
public class QDocCreationService {

    private final QDocRepository qdocs;
    private final DocumentNumberGenerator documentNumbers;
    private final IdentityProvider identities;
    private final PreparationEventPublisher events;
    private final Clock clock;

    public QDocCreationService(QDocRepository qdocs, DocumentNumberGenerator documentNumbers,
            IdentityProvider identities, PreparationEventPublisher events, Clock clock) { ... }

    /**
     * Creates a QDoc on a quality manager's request.
     *
     * <p>Actors: Quality manager.
     *
     * @param command the creation request
     * @return the identity of the created QDoc
     */
    @CommandHandler
    @Transactional
    public QDocId createQDoc(CreateQDoc command) {
        if (!identities.isQualityManager(command.requestedBy())) {
            throw new NotAQualityManagerException(command.requestedBy());
        }
        QDoc qdoc = QDoc.create(command, documentNumbers.next(command.documentType()), clock.instant());
        qdocs.save(qdoc);
        qdoc.pullEvents().forEach(events::publish);
        return qdoc.id();
    }
}
```

## Rejections and exceptions

1. A broken rule throws an unchecked exception named after what went wrong
   in the domain (`BlankQDocTitleException`, `NotAQualityManagerException`),
   with a message in the design document's language that names the rule.
2. Each root module has one abstract `DomainException extends
RuntimeException` in its package; every domain exception extends it.
3. When the design document models outcomes as building blocks (a base
   with `Accepted` and `Rejected` implementers), the behaviour returns them
   instead, as a sealed interface handled with an exhaustive `switch`.
4. Exceptions carry no annotation: they are not building blocks.
5. Never catch and swallow a domain exception in an application service.
