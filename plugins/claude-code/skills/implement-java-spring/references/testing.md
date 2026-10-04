# Testing the scenarios

Every scenario of the design document becomes exactly one test, and every
test is one scenario. The test proves the scenario's given, when and then
against the code; its names carry the scenario back, so a later design
document that modifies or removes the scenario finds it.

Tests run on JUnit Jupiter without Spring: no `@SpringBootTest`, no
`@ExtendWith(SpringExtension.class)`, no application context. Assertions
use AssertJ only.

## Which test a scenario gets

Find the element a scenario belongs to: the rule it is attached to belongs
to a behaviour or a building block, and so does a scenario attached
directly.

| The scenario belongs to                                                                         | Test                                                                                    |
| ----------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| a `public` behaviour of an `application_service`, or a rule of one                              | a **full-graph test** of that behaviour                                                 |
| an `application_service` building block, or one of its rules                                    | a **full-graph test** of the behaviour the scenario's _when_ calls                      |
| any other building block or behaviour: value object, entity, aggregate, domain service, factory | a **unit test** of that element                                                         |
| a `repository` or an `external_integration`, or a behaviour of one                              | **no test now**: there is no implementation in scope. Report it for the adapter's tests |

### Full-graph tests

A use case is tested through its application service, with the whole domain
object graph behind it real: the aggregates, entities, value objects, domain
services, factories and policies are the production classes, built with
`new` in the test. Only what lies outside the domain is replaced:

- each **external integration** by a stub or a recording fake;
- each **repository** by an in-memory implementation, so the test can load
  what the use case saved;
- the **clock** by `Clock.fixed(...)`.

Never replace a domain building block with a mock, a stub or a subclass,
even when that would make the test shorter. The test asserts what the
scenario's _then_ says, through what the outside world sees: the
behaviour's result, the aggregate the in-memory repository holds, the
events the recording publisher received, the calls the recording fake of an
external integration took.

### Unit tests

Any other building block is tested alone, through its own behaviours and
constructor: a value object by constructing it, an aggregate by calling its
behaviours, a domain service with its collaborators passed in. No mocks:
build the real value objects and aggregates it takes. A domain service's
external integration collaborator, when it has one, gets the same test
double a full-graph test would use.

A scenario is often written from the use case's point of view, even when it
is attached to a value object ("when the quality manager submits a request
whose title is only spaces, then the request is rejected"). Test it at the
level of the element it belongs to: the part of the _when_ that reaches the
element (constructing a title of spaces) and the part of the _then_ the
element decides (it refuses with `BlankQDocTitleException`). Setup in the
_given_ that does not reach the element is left out of the test, not
faked.

## Test layout

- One test class per building block, `<BuildingBlock>Test`, in
  `src/test/java` under the building block's package, so it reads
  package-private accessors.
- Inside it, one `@Nested` class per behaviour that has scenarios, named
  after the behaviour in upper camel case plus `Tests`
  (`CreateQDocTests`), with `@DisplayName("<behaviour name>")`.
- Inside the building block's or the behaviour's class, one `@Nested`
  class per rule that has scenarios, named after the rule in upper camel
  case (`OnlyQualityManagersCreateQDocs`), with
  `@DisplayName("<rule name>")`.
- One test method per scenario, where it is attached: in its rule's class,
  or directly in its behaviour's or building block's class.
  `@DisplayName("<scenario name>")` verbatim, the method named after the
  scenario in snake case (`a_quality_manager_is_accepted`).
- The method's body falls into three parts, each opened by a comment that
  quotes the scenario, in its language:

```java
// given a user holding the quality manager role
// when the user submits a valid QDoc creation request
// then the QDoc is created
```

- A scenario whose _given_ lists alternatives that share one _when_ and
  _then_ ("a user holding only the author role, one holding only the
  reviewer role, …") is one `@ParameterizedTest` over them, still one test
  method.
- Test data comes from small factory methods in the ubiquitous language
  (`aValidCreationRequest()`, `requestedBy(manager)`), in the test class or,
  shared by a module's tests, in a package-private `<Module>Fixtures` class
  in its test package. They build real domain objects.

## Test doubles

Hand-written, in `src/test/java` under the package of the interface they
implement, package-private, unannotated. No Mockito: every double is a small
class whose state an AssertJ assertion reads.

| Double                   | For                                          | Shape                                                                                                |
| ------------------------ | -------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| `InMemory<Repository>`   | a repository                                 | a `Map` by identifier; implements the interface, plus package-private helpers to read what was saved |
| `Stub<Integration>`      | an external integration the use case asks    | answers what the test set up (`qualityManager()` registers and returns a user who is one)            |
| `Recording<Integration>` | an external integration the use case tells   | keeps every call's arguments in a list the test reads (`published`)                                  |
| `Fake<Integration>`      | an integration that both answers and is told | both of the above                                                                                    |

```java
class RecordingPreparationEventPublisher implements PreparationEventPublisher {

    final List<QDocCreated> published = new ArrayList<>();

    @Override
    public void publish(QDocCreated event) {
        published.add(event);
    }
}
```

A rule that something happens _together_ ("saved and announced together:
either both happen or neither does") is tested from the side the domain
decides: a rejected request leaves the in-memory repository empty and the
recording publisher silent.

## AssertJ

`import static org.assertj.core.api.Assertions.*;` and nothing from
`org.junit.jupiter.api.Assertions`, Hamcrest or Mockito's `verify`.

- Values: `assertThat(actual).isEqualTo(expected)`; collections with
  `containsExactly`, `containsExactlyInAnyOrder`, `hasSize`, `isEmpty`;
  optionals with `isPresent`, `isEmpty`, `hasValue`.
- Several facts of one object: `extracting(...)` with a tuple, or
  `satisfies(...)`. Several facts of one _then_ on different objects:
  `assertSoftly(softly -> ...)` so one failure does not hide the rest.
- Rejections: `assertThatExceptionOfType(BlankQDocTitleException.class)
.isThrownBy(() -> new QDocTitle("   "))`, then, when the scenario says
  more, `.withMessageContaining(...)`. Never `assertThrows`.
- Assert what the _then_ says, and all of it: "an active QDoc with a
  document number, its version 1 with the status new, one empty content
  file, the author and the two reviewers, and QDocCreated is published" is
  five assertions, not one.

## Examples

A full-graph test of a use case:

```java
class QDocCreationServiceTest {

    private final InMemoryQDocRepository qdocs = new InMemoryQDocRepository();
    private final StubIdentityProvider identities = new StubIdentityProvider();
    private final RecordingPreparationEventPublisher events = new RecordingPreparationEventPublisher();
    private final Clock clock = Clock.fixed(Instant.parse("2026-10-01T09:00:00Z"), ZoneOffset.UTC);

    private final QDocCreationService service =
            new QDocCreationService(qdocs, new DocumentNumberGenerator(), identities, events, clock);

    @Nested
    @DisplayName("createQDoc")
    class CreateQDocTests {

        @Nested
        @DisplayName("Only quality managers create QDocs")
        class OnlyQualityManagersCreateQDocs {

            @Test
            @DisplayName("A quality manager is accepted")
            void a_quality_manager_is_accepted() {
                // given a user holding the quality manager role
                UserId manager = identities.qualityManager();

                // when the user submits a valid QDoc creation request
                QDocId id = service.createQDoc(aValidCreationRequest(manager));

                // then the QDoc is created
                assertThat(qdocs.find(id)).isPresent();
            }
        }
    }
}
```

A unit test of a value object's rule:

```java
class QDocTitleTest {

    @Nested
    @DisplayName("A title is never blank")
    class ATitleIsNeverBlank {

        @Test
        @DisplayName("Blank title")
        void blank_title() {
            // given a quality manager
            // when the quality manager submits a QDoc creation request whose title is only spaces
            // then the request is rejected and no QDoc is created
            assertThatExceptionOfType(BlankQDocTitleException.class)
                    .isThrownBy(() -> new QDocTitle("   "));
        }
    }
}
```
