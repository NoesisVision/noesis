# Testing the rules and scenarios

Every rule of the design document that has scenarios becomes a `Rule:` of
a Gherkin feature file, and every scenario a `Scenario:` under it. Cucumber
runs them as tests on the JUnit Platform, and the Noesis scan reads the
same files back as the model's rules and scenarios. So the feature file is
both the test and the contract with the next scan: a scanned rule or
scenario matches the designed one by name, a scanned `governs` by the
behavior the scenario's `When` steps call.

Each scenario is exactly one Cucumber scenario; there is no JUnit test per
scenario beside it. Step definitions run without Spring: no
`cucumber-spring`, no `@SpringBootTest`, no application context. They
assert with AssertJ only.

## What the scan reads

- A `Rule:` is a rule: the line is the rule's `name` verbatim, the free
  text under it its `description`. It carries exactly one kind tag, the
  rule's `kind`: `@validation`, `@state_change`, `@post`, `@computation`,
  `@coordination` or `@configuration`.
- A `Scenario:` or `Scenario Outline:` under the rule is a scenario, its
  `name` the line verbatim, its steps as written. The feature's
  `Background:` steps come first. A scenario outside a `Rule:` is not
  read.
- The scenario's `When` step, with the `And` and `But` steps after it, is
  matched against the `@When` step definitions. The methods it binds to
  must call exactly one behavior between them, directly or through
  methods that are no behavior (private helpers, test doubles, a
  constructor): that behavior governs the rule, and the rule lives in its
  module. `Given` and `Then` steps are not read; they may call anything.
- Dropped, with a note in the scan's log: a rule with no kind tag or two,
  a `When` step that matches no step definition or several, `When` steps
  that call no behavior or several, a rule none of whose scenarios binds.

## Which behavior a scenario's When calls

The behavior that governs the scenario's rule: the `from` of a `governs`
relation to the rule. With one, that is it; with several, the one the
scenario's _when_ describes. The `When` step calls it on the real domain
object and nothing else that is a behavior. Whatever has to exist before
the call (the request, the aggregate, the registered users) is built in
the `Given` steps, or in the `When` step only through constructors,
fixtures and test doubles.

| The governing behavior is one of                                                   | Its scenarios                                                                        |
| ---------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| an `application_service`                                                           | **full graph**: the service built with the whole domain behind it (below)            |
| any other building block: value object, entity, aggregate, domain service, factory | **the block alone**: built in the `Given` steps, its behavior called in the `When`   |
| a `repository`, an `external_integration`, an adapter or a `technical_service`     | **none now**: there is no implementation in scope. Report it for the adapter's tests |

A scenario is often written from the use case's point of view, even when
the behavior that governs its rule is an aggregate's or a value object's
("when the quality manager creates a QDoc, then version 1 has the status
new", governed by `Version.createFirst`). Its `When` step still calls the
governing behavior, not the use case; the `Given` and `Then` steps build
and read what that behavior takes and returns. Setup in the _given_ that
does not reach the behavior is a step that records nothing, not a fake.

### Full graph

A use case is tested through its application service, with the whole
domain object graph behind it real: the aggregates, entities, value
objects, domain services, factories and policies are the production
classes, built with `new` in the steps class. Only what lies outside the
domain is replaced:

- each **external integration** by a stub or a recording fake;
- each **repository** by an in-memory implementation, so a `Then` step
  can load what the use case saved;
- the **clock** by `Clock.fixed(...)`.

Never replace a domain building block with a mock, a stub or a subclass.
The `Then` steps assert what the scenario's _then_ says, through what the
outside world sees: the behavior's result, the aggregate the in-memory
repository holds, the events the recording publisher received, the calls
the recording fake of an external integration took.

## Writing the steps

The scenario's steps are the design's steps, in order: each `given` a
`Given`, each `when` a `When`, each `then` a `Then`, a repeated kind
`And`. Keep their text verbatim, with two exceptions, each a deviation to
report:

- **One wording, one behavior.** Cucumber binds a step's text to one step
  definition in the whole suite, so one `When` wording calls one behavior.
  When the design words the _when_ of two scenarios alike but their rules
  are governed by different behaviors ("when the quality manager creates
  a QDoc" for a rule of `QDoc.create` and one of `Version.createFirst`),
  reword the ones that are not the use case's so they name what is
  created or done ("When a QDoc is created from a valid request", "When
  version 1 is created for the request").
- **Alternatives become an outline.** A _given_ that lists alternatives
  sharing one _when_ and _then_ ("a user holding only the author role, one
  holding only the reviewer role, …") is one `Scenario Outline:` with an
  `Examples:` table, still one scenario.

A _given_ every scenario of the feature opens with goes in its
`Background:` once.

## Layout

- **Feature files** under `src/test/resources/features/<module>/`, one
  per use case: the application service behavior whose scenarios they
  tell, with the rules of the domain behaviors it reaches. Name the file
  after the use case in kebab case (`creating-a-qdoc.feature`); its
  `Feature:` line is the use case in words, the text under it its
  definition. A rule whose governing behavior no use case reaches goes in
  a feature of its own, named after that behavior. The rules follow the
  design document's order.
- **Steps**: one public class per feature file, `<Feature>Steps`
  (`CreatingAQDocSteps`), in `src/test/java` under the package of the
  use case's application service, so it reads package-private accessors.
  Cucumber builds a new instance for every scenario: keep the scenario's
  state (the service, the doubles, the result, the rejection) in fields.
  A step wording two feature files share has one definition: when two
  features of a module share wordings, give them one steps class, named
  after the module (`PreparationSteps`).
- **Runner**: one class in the root package of the test sources:

```java
/** Runs the rules and scenarios of src/test/resources/features with Cucumber. */
@Suite
@IncludeEngines("cucumber")
@SelectPackages("features")
@ConfigurationParameter(key = GLUE_PROPERTY_NAME, value = "com.example.qdocmanagement")
class RunCucumberTest {
}
```

- **Test data** comes from small factory methods in the ubiquitous
  language (`aValidCreationRequest()`, `requestedBy(manager)`), in a
  package-private `<Module>Fixtures` class in the module's test package.
  They build real domain objects.

## Step definitions

`io.cucumber.java.en.Given`, `When` and `Then`, each with the step's text
as a Cucumber expression: `{int}`, `{word}` and `{string}` for the values
the text carries, an outline's `<placeholder>` matched like any other
value.

- A `When` step whose behavior may refuse catches the domain exception
  into a field, so the `Then` steps can assert either outcome:

```java
@When("the quality manager submits a valid QDoc creation request")
public void theQualityManagerSubmitsAValidRequest() {
    submit(() -> aValidCreationRequest(manager));
}

/** Submits the request the supplier builds; building it may already refuse it. */
private void submit(Supplier<CreateQDoc> request) {
    try {
        created = service.createQDoc(request.get());
    }
    catch (DomainException rejected) {
        rejection = rejected;
    }
}
```

- A `Then` step asserts what the _then_ says, and all of it: "an active
  QDoc with a document number, its version 1 with the status new, one
  empty content file, the author and the two reviewers, and QDocCreated is
  published" is five assertions, in one `assertSoftly`.

## Test doubles

Hand-written, in `src/test/java` under the package of the interface they
implement, package-private, unannotated. No Mockito: every double is a
small class whose state an AssertJ assertion reads.

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
decides: a refused request leaves the in-memory repository empty and the
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
- Refusals: `assertThat(rejection).isInstanceOf(BlankQDocTitleException.class)`,
  then, when the scenario says more, `.hasMessageContaining(...)`.

## Example

A rule of a use case and one of an entity, in one feature:

```gherkin
Feature: Creating a QDoc
  A quality manager creates a QDoc in the Preparation subsystem.

  Background:
    Given a quality manager

  @validation
  Rule: Only quality managers create QDocs
    A QDoc creation request from a user who lacks the quality manager role
    is rejected.

    Scenario Outline: Non-quality-managers are rejected
      Given a user holding only the <role> role
      When that user submits a valid QDoc creation request
      Then the request is rejected and no QDoc is created

      Examples:
        | role     |
        | author   |
        | reviewer |

  @state_change
  Rule: Version 1 starts with the status new
    Creating a QDoc creates its version 1, with the status new.

    Scenario: One version, numbered 1, new
      When version 1 is created for a valid request
      Then version 1 is numbered 1, with the status new
```

```java
/** The steps of features/preparation/creating-a-qdoc.feature. */
public class CreatingAQDocSteps {

    private final InMemoryQDocRepository qdocs = new InMemoryQDocRepository();
    private final StubIdentityProvider identities = new StubIdentityProvider();
    private final QDocCreationService service = new QDocCreationService(qdocs, new SequentialDocumentNumberGenerator(),
            identities, new RecordingPreparationEventPublisher(), Clock.fixed(NOW, ZoneOffset.UTC));

    private UserId manager;
    private UserId user;
    private QDocId created;
    private DomainException rejection;
    private Version version;

    @Given("a quality manager")
    public void aQualityManager() {
        manager = identities.qualityManager();
    }

    @Given("a user holding only the {word} role")
    public void aUserHoldingOnlyTheRole(String role) {
        user = identities.userHolding(role);
    }

    // Governed by QDocCreationService.createQDoc: the use case.
    @When("that user submits a valid QDoc creation request")
    public void thatUserSubmitsAValidRequest() {
        submit(() -> aValidCreationRequest(user));
    }

    // Governed by Version.createFirst: the entity, called alone.
    @When("version 1 is created for a valid request")
    public void version1IsCreatedForAValidRequest() {
        CreateQDoc request = aValidCreationRequest(manager);
        version = Version.createFirst(request.authors(), request.reviewers(), request.approvers());
    }

    @Then("the request is rejected and no QDoc is created")
    public void theRequestIsRejected() {
        assertThat(rejection).isNotNull();
        assertThat(qdocs.all()).isEmpty();
    }

    @Then("version 1 is numbered 1, with the status new")
    public void version1IsNumbered1WithTheStatusNew() {
        assertThat(version.number()).isEqualTo(1);
        assertThat(version.status()).isEqualTo(VersionStatus.NEW);
    }

    private void submit(Supplier<CreateQDoc> request) { ... }
}
```
