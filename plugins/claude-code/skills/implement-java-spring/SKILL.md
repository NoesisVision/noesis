---
name: implement-java-spring
description: Implement a Noesis design document as Java domain code in a Spring Boot project — modules as packages, building blocks as annotated classes, records and interfaces, behaviours as public methods — with one JUnit test per scenario, asserted with AssertJ. Domain and application services only; no controllers, persistence or wiring. Use when the user asks to implement, code or build a design document, or a change's design, in Java or Spring.
argument-hint: [change-id] [design-doc-id] [instructions]
---

# Implement a design document in Java and Spring

A design document says what a change does to the domain model: the modules,
building blocks and behaviours it adds, modifies or removes, with their
properties, rules and scenarios. You turn it into Java domain code that the
Noesis Java scanner reads back as the same model, and into tests that prove
every scenario. Each module becomes a package, each building block a type
carrying its `vision.noesis.annotations` stereotype, each behaviour a public
method. An application service's behaviours also carry `@CommandHandler`,
`@QueryHandler` or `@EventHandler` after their type, and the commands,
queries and events they handle carry `@Command`, `@Query` or `@Event`.
Each scenario becomes exactly one test.

The scope is the domain: value objects, entities, aggregates, domain
services, factories, the repository and external integration interfaces,
and the application services that orchestrate them. Never controllers,
persistence adapters, messaging, JPA mappings, `@Configuration` wiring or
implementations of an external integration. They come later, with the
adapters.

## Contracts

- Design document: `${CLAUDE_PLUGIN_ROOT}/contracts/design-document.schema.json`,
  with a worked example beside it, `design-document.example.json`.
- Baseline: `${CLAUDE_PLUGIN_ROOT}/contracts/system-model.schema.json`, the
  shape `get_newest_system_model` answers with.

Both are JSON Schema. Read them at step 2, not from memory.

## References

Read all three at step 5, before planning:

- `${CLAUDE_PLUGIN_ROOT}/skills/implement-java-spring/references/mapping.md`:
  how each element of the design document becomes Java so the scanner reads
  it back. Packages, annotations, names, types and signatures.
- `${CLAUDE_PLUGIN_ROOT}/skills/implement-java-spring/references/building-blocks.md`:
  how to implement each building block type well. The DDD and clean
  architecture rules, with code shapes.
- `${CLAUDE_PLUGIN_ROOT}/skills/implement-java-spring/references/testing.md`:
  which kind of test each scenario gets, the test doubles, the test layout
  and AssertJ.

## Steps

1. **Pick the change.** Call `list_changes`. When the user named a change
   (an id, a name or a tracker key) and exactly one listed change matches,
   use its id. Otherwise ask the user which change to implement, offering
   the listed changes by name, key and id, newest first.
2. **Pick the design document.** The service offers no tool that reads one,
   so read it from the change's folder:
   `.noesis/graph/changes/<change id>/*.design-doc.json`. When there are
   several (alternatives, or later revisions), ask the user which one to
   implement, offering each by `name` and id (the file name without
   `.design-doc.json`). When the chosen one has `implemented: true`, ask
   whether to implement it anyway. Read both contracts now: every field of
   the document is `{ "changed": true, "value": … }` or
   `{ "changed": false }`, and only a changed field has a value.
3. **Load the baseline.** Call `get_newest_system_model`. Every `modified`
   and `removed` id names an element in it, and its `source.path` says
   where its code lives. Scan first with `scan_system_model`, then call
   `get_newest_system_model` again, when the design document modifies or
   removes elements and there is no scan, or the code has moved on since
   `scanned_at`.
4. **Read the project.** Find:
   - the build. Maven is expected (`pom.xml`, `./mvnw`). Never add Gradle
     files; on a Gradle project use its wrapper and add nothing else.
   - the Java version (`java.version` or `maven.compiler.release`); records
     and sealed types need 17 and pattern-matching `switch` 21.
   - the `@SpringBootApplication` class and its package, which anchors the
     module packages ([mapping](references/mapping.md#modules-and-packages)).
   - the test classpath: JUnit Jupiter and AssertJ, which
     `spring-boot-starter-test` brings, directly or through another
     `spring-boot-starter-*-test`.
   - `vision.noesis:noesis-annotations` among the dependencies.
   - the code that already exists in the packages the design touches, and
     its conventions.
5. **Plan.** Read the three references now. Then, for every element the
   design document adds, modifies or removes, decide:
   - its file: package, type name, Java shape and annotation;
   - its public methods, one per behaviour, with their exact signatures;
   - where each rule is enforced and which exception a broken one throws;
   - for every scenario, its test: the test class, the nesting by
     behaviour and rule, and whether it is a full-graph test of an
     application service or a unit test
     ([testing](references/testing.md#which-test-a-scenario-gets));
   - the test doubles the full-graph tests need.

   Then look for what the design document leaves open or what Java cannot
   express as written: a signature that cannot compile as given (a static
   creation behaviour whose output is not the block it creates), several
   outputs with no base building block, a collaborator a behaviour's
   diagram calls that the design does not name, a property typed with
   another aggregate, a scenario on an interface that has no implementation
   in scope, a rule with no scenario. Resolve one yourself only when the
   design document or the references say how. Ask the user about every
   other one in one `AskUserQuestion` round, each question with two or
   three candidate answers, your recommendation first. Do not add a
   building block or a behaviour the design document does not name: that
   is a change to the design, for the user to make in Noesis.

6. **Prepare the build.** When the test classpath lacks JUnit Jupiter or
   AssertJ, add `org.springframework.boot:spring-boot-starter-test` with
   `test` scope and no version: the Spring Boot parent manages it. When
   `noesis-annotations` is missing, add it; it is not on Maven Central
   yet, so when it does not resolve, tell the user where to install it from
   and stop.
7. **Write the production code** in dependency order, so each type compiles
   against what is already there:
   1. modules: `package-info.java` with `@Module`;
   2. identifiers, value objects and messages (commands, queries, events);
   3. entities, then aggregates;
   4. domain services and factories;
   5. repositories and external integrations, as interfaces;
   6. application services.

   For a `modified` element, edit its code where `source.path` points and
   change only what the design document changes. For a `removed` one,
   delete its type or method, every use of it and its tests.

8. **Write the tests**: the test doubles first, then one test per scenario,
   as the plan decided. Modified scenarios change their test; removed ones
   delete it. Find an existing test by its `@DisplayName`, which carries the
   scenario's name.
9. **Build and run the tests**: `./mvnw -q test`, or `mvn -q test` without
   a wrapper. Fix the production code until every test passes. Change a
   test only when it misreads its scenario, never to make wrong code pass.
   A test that cannot pass because the design document contradicts itself
   is a question for the user, not a reason to weaken the test.
10. **Check the result** against the design document, element by element:
    - every added or modified module has a package with `@Module`, every
      building block a type with its annotation, and every behaviour a
      public method of exactly its name;
    - every application service behaviour carries `@CommandHandler`,
      `@QueryHandler` or `@EventHandler` after its type, and no other
      method does;
    - every command, query and event carries `@Command`, `@Query` or
      `@Event`;
    - an annotated type has no public method the design document does not
      name, except the ones Java writes itself
      ([mapping](references/mapping.md#the-public-surface));
    - every scenario has exactly one test, and every test belongs to a
      scenario;
    - the domain code imports no Spring, JPA, Jakarta Validation or
      Jackson type, and an application service only Spring's
      `@Transactional`;
    - nothing the design document removes is left, and nothing refers to
      it.
11. **Report**: the design document's id; the files created, changed and
    deleted; how many modules, building blocks, behaviours and scenarios
    were implemented, and the test result. Then every deviation from the
    design document and why, every rule left without a test, every scenario
    left untested and why, and what comes next: mark the design document
    implemented in the Noesis page, scan the code, and add the adapters.

## Rules

- Implement what the design document says, by its names. A name that
  differs from the design document is a difference the next scan shows.
- Never write under `.noesis/`. Read the design document there; change it
  only in the Noesis page, which is the user's.
- Never commit. The user reviews the code first.
- Never mock or stub a building block of the domain in a test. Only an
  external integration has a test double, and a repository an in-memory
  one.
- Do not leave a test failing, skipped or disabled. Report what you could
  not make pass instead.
