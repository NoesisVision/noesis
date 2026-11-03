---
name: setup-java-scanner
description: Set up Noesis scanning for a Java repository — add the Noesis parser plugin to its Maven or Gradle build, add the noesis-annotations dependency its domain code is annotated with, and write the "parser" of .noesis/settings.json that runs the build — then prove it with a scan. Use when the user asks to set up, configure, enable or fix Noesis scanning for a Java, Maven, Gradle or Spring project, when `scan_system_model` fails because .noesis/settings.json is missing or names no parser, when the session start notice offers it, or when `scan_system_model` refuses the code model schema the Java parser wrote (the parser or the plugin is out of date).
argument-hint: [maven|gradle] [engine]
---

# Set up Noesis scanning for a Java repository

The Noesis service scans a Java repository by running the repository's own
build: the build declares the Noesis parser plugin, and the `parser` of
`.noesis/settings.json` gives the service the command line that runs it.
The domain code carries the `vision.noesis.annotations` stereotypes the
parser reads (`@AggregateRoot`, `@ValueObject`, …), so the build also needs
the `noesis-annotations` dependency. You add those three things and prove
them with a scan. The service holds no Maven or Gradle knowledge: what you
write is all it knows.

Ask before editing any build file, and show the user what you changed.

## Where the artifacts come from

| Artifact                            | Coordinates                                |
| ----------------------------------- | ------------------------------------------ |
| Annotations                         | `vision.noesis:noesis-annotations`         |
| Maven plugin (goal prefix `noesis`) | `vision.noesis:noesis-parser-maven-plugin` |
| Gradle plugin                       | id `vision.noesis.parser`                  |

All three are on Maven Central and release together, under one version.
The Gradle plugin is on Maven Central only, not on the Gradle Plugin
Portal, so a Gradle build needs `mavenCentral()` among its plugin
repositories.

This skill names no version: it installs the newest release, which step 6
looks up. Below, `<version>` stands for that release; write the version
itself in its place.

What ties a parser release to this plugin is the code model schema: the
parser writes one schema version, the Noesis service in this plugin reads
one, and a scan refuses a model of another. Which release writes which
schema is in the "Compatibility" table of the parser's README,
`https://raw.githubusercontent.com/NoesisVision/noesis/main/code-parsers/java/README.md`.
[Update](#update) is what to do when a scan refuses it.

The annotations need not move with the parser: the parser reads them by
name, so a build may keep an older `noesis-annotations` when the parser
plugin moves on.

## Steps

1. **Read the settings.** If `.noesis/settings.json` exists, read it. When it
   already names a `parser`, tell the user and ask whether to replace it
   before going on. Keep its `namespacePartsToSkip` and `namespacesToExclude`.
   The file is strict: those two keys and `parser` are the only ones allowed.
2. **Find the build.** At the repository root:
   - Maven: `pom.xml`; the wrapper is `./mvnw`. A `<modules>` list makes it
     a multi-module build.
   - Gradle: `settings.gradle` or `settings.gradle.kts`, `build.gradle` or
     `build.gradle.kts`; the wrapper is `./gradlew`. Note the DSL (Groovy or
     Kotlin) and whether `include(...)` names subprojects.

   Both present: ask which one builds the code. Neither: stop and tell the
   user the Java parser runs through Maven or Gradle only. A build that is
   not at the repository root: ask, and run the command from there with
   `-f <dir>/pom.xml` (Maven) or `-p <dir>` (Gradle).

3. **Check the JDK.** The parser runs inside Maven or the Gradle daemon and
   needs a JDK 17 or newer, not a JRE: run `javac -version`. On a JRE every
   module reports `NS1003`. Tell the user if it is missing or older; do not
   install a JDK yourself.
4. **Pick the engine.** Search the build for annotation processors:
   `lombok`, `annotationProcessor`, `<annotationProcessorPaths>`,
   `mapstruct`. With any of them, use `hybrid`: the default `source` engine
   runs no processors, so the members Lombok generates and the calls to them
   would be missing. Otherwise leave the engine out, which means `source`.
   An engine the user names in the arguments wins.
5. **Check where the build resolves from.** The artifacts come from Maven
   Central. A Maven build reaches it unless a `<mirror>` in
   `~/.m2/settings.xml` or the project's `.mvn/` sends everything to a
   company repository; a Gradle build needs `mavenCentral()` in the
   repositories named under [Gradle](#gradle). When a mirror or a company
   repository stands in for Central, tell the user the three coordinates
   above must be available there.
6. **Resolve the version.** Read the `<release>` element of
   `https://repo1.maven.org/maven2/vision/noesis/noesis-parser-maven-plugin/maven-metadata.xml`:
   that is `<version>` for the plugin and for the annotations (the Gradle
   plugin and the annotations release with it). Without network access,
   ask the user for the version. When the build already pins
   `noesis-annotations`, keep its version for the annotations.
7. **Edit the build.** Follow [Maven](#maven) or [Gradle](#gradle) below.
8. **Write `.noesis/settings.json`.** Create `.noesis/` if needed. Use the
   command for the build from [the settings](#the-settings), and fill in:
   - `namespacePartsToSkip`: the package prefix every module shares and
     that says nothing about the domain, usually the organisation part of
     the base package (`com.acme` for `com.acme.billing.invoices`). Propose
     it from the packages under `src/main/java` and confirm with the user.
   - `namespacesToExclude`: patterns of packages to leave out of the model,
     where `*` stands for any number of parts (`*.config.*`). Empty unless
     the user asks.
9. **Prove it.** Call `scan_system_model`. On success, report what the
   model holds: its modules and how many building blocks it found. Before
   anything is annotated, the model has modules but no building blocks;
   say so, so an empty model does not look like a failure. On failure, the
   error carries the end of the build's output: fix what it names (a
   missing artifact or plugin is step 5, a JRE is step 3, a code model
   schema the plugin does not read is [Update](#update)) and scan again.
10. **Tell the user what is next.** The parser turns annotated types into
    building blocks: list the [annotations](#annotations) and offer to
    annotate the existing domain code. Rules and scenarios come from
    feature files instead: say how, as
    [Rules and scenarios](#rules-and-scenarios) does. Do not annotate the
    code or write feature files as part of this setup.

## Maven

In the root `pom.xml`, add the plugin to `<build><plugins>` (not only to
`<pluginManagement>`), so `noesis:parse` resolves from the root and runs for
every module of a reactor; `pom` modules are skipped:

```xml
<plugin>
  <groupId>vision.noesis</groupId>
  <artifactId>noesis-parser-maven-plugin</artifactId>
  <version><version></version>
  <!-- Only with annotation processors (Lombok): -->
  <configuration>
    <engine>hybrid</engine>
  </configuration>
</plugin>
```

Add the annotations to `<dependencies>` of every module that holds domain
code; in a single-module build that is the root `pom.xml`:

```xml
<dependency>
  <groupId>vision.noesis</groupId>
  <artifactId>noesis-annotations</artifactId>
  <version><version></version>
</dependency>
```

In a multi-module build whose modules inherit from the root, put the version
in the root's `<dependencyManagement>` and leave it out in the modules. Keep
the indentation and the place of comments the POM already has.

## Gradle

In the settings file, let the plugin resolve from Maven Central. Add
`mavenCentral()` to an existing `pluginManagement { repositories { } }`.
When there is none, create it with `gradlePluginPortal()` as well, or every
other plugin of the build stops resolving:

```groovy
pluginManagement {
    repositories {
        mavenCentral()
        gradlePluginPortal()
    }
}
```

Apply the plugin once, in the root build file; its `noesisParse` task is
registered on the root project and parses every project with the `java`
plugin in dependency order:

```groovy
plugins {
    id 'vision.noesis.parser' version '<version>'
}

// Only with annotation processors (Lombok):
noesis {
    engine = 'hybrid'
}
```

Add the annotations to every project that holds domain code, and
`mavenCentral()` where that project's repositories are declared, unless it
is there already. When the settings file has
`dependencyResolutionManagement { repositories { } }`, add it there instead;
under `FAIL_ON_PROJECT_REPOS` it must go there:

```groovy
repositories {
    mavenCentral()
}

dependencies {
    implementation 'vision.noesis:noesis-annotations:<version>'
}
```

In the Kotlin DSL the same lines read:

```kotlin
// settings.gradle.kts
pluginManagement {
    repositories {
        mavenCentral()
        gradlePluginPortal()
    }
}

// build.gradle.kts
plugins {
    id("vision.noesis.parser") version "<version>"
}

noesis {
    engine.set("hybrid")
}

repositories {
    mavenCentral()
}

dependencies {
    implementation("vision.noesis:noesis-annotations:<version>")
}
```

A version catalog (`gradle/libs.versions.toml`) in the build: add the
annotations and the plugin there and refer to them through it, as the build
does for its other dependencies.

## Update

When `scan_system_model` fails with
`noesis-parse-java <release> wrote code model schema <P>; this Noesis plugin reads schema <S>.`,
the parser and the plugin disagree on the code model schema. Settings and
annotations stay as they are; only the parser's version moves, or the
plugin.

- **The parser is behind** (`<P>` is less than `<S>`). Look up the newest
  release as in step 6, and check in the compatibility table that it writes
  schema `<S>`; when none does yet, tell the user that no parser release
  writes the schema this plugin reads yet, and stop. Otherwise set the pins to it:
  - Maven: the `<version>` of `noesis-parser-maven-plugin`, and of
    `noesis-annotations` (or the property or `<dependencyManagement>`
    entry they take it from).
  - Gradle: the `id 'vision.noesis.parser' version` line in `plugins {}`,
    and the `noesis-annotations` line in `dependencies {}`; with a version
    catalog, its entries in `gradle/libs.versions.toml`.

  Moving the annotations is optional (see above); ask when the build pins
  them apart from the parser. Then scan again.

- **The parser is ahead** (`<P>` is greater than `<S>`). Offer the user two
  ways, the first recommended:
  1. Update the plugin, so it reads schema `<P>`:
     `/plugin marketplace update noesis`, then
     `/plugin update noesis-beta@noesis`, then restart Claude Code or run
     `/reload-plugins`. The user runs these; you cannot.
  2. Keep the plugin and pin the parser back: read the compatibility table,
     take the newest release whose schema is `<S>`, and set the pins to it
     as for a parser that is behind.

  After either, scan again.

## The settings

The service runs `command` from the repository root and fills `{out}` with a
fresh output directory, `{root}` with the repository root and `{name}` with
its name. `installHint` is what the scan says when the command cannot start.

Maven, with the wrapper (`mvn` without one):

```json
{
  "parser": {
    "language": "java",
    "command": [
      "./mvnw",
      "-B",
      "-q",
      "-ntp",
      "-Dnoesis.out={out}",
      "-Dnoesis.repository={name}",
      "-Dmaven.compiler.failOnError=false",
      "process-classes",
      "noesis:parse"
    ],
    "installHint": "Run the service on a JDK 17+; the build takes noesis-parser-maven-plugin from Maven Central."
  },
  "namespacePartsToSkip": ["com.acme"],
  "namespacesToExclude": []
}
```

`-Dmaven.compiler.failOnError=false` lets a module that does not compile be
parsed from its sources anyway; it belongs to the compiler plugin, so it
stays on the command line.

Gradle, with the wrapper (`gradle` without one):

```json
{
  "parser": {
    "language": "java",
    "command": [
      "./gradlew",
      "-q",
      "noesisParse",
      "-Pnoesis.out={out}",
      "-Pnoesis.repositoryRoot={root}",
      "-Pnoesis.repository={name}"
    ],
    "installHint": "Run the service on a JDK 17+; the build takes the vision.noesis.parser plugin from Maven Central (mavenCentral() in pluginManagement)."
  },
  "namespacePartsToSkip": ["com.acme"],
  "namespacesToExclude": []
}
```

On Windows the wrappers are `mvnw.cmd` and `gradlew.bat`.

## Annotations

All in `vision.noesis.annotations`. On a type:

| Annotation                      | Building block       |
| ------------------------------- | -------------------- |
| `@AggregateRoot`                | aggregate            |
| `@DomainEntity`                 | entity               |
| `@ValueObject`                  | value object         |
| `@Identifier`                   | value object (an id) |
| `@DomainService`                | domain service       |
| `@ApplicationService`           | application service  |
| `@Repository`                   | repository           |
| `@Factory`                      | factory              |
| `@ExternalIntegration`          | external integration |
| `@Adapter(Direction.PRIMARY)`   | in adapter           |
| `@Adapter(Direction.SECONDARY)` | out adapter          |
| `@TechnicalService`             | technical service    |
| `@Command`                      | command              |
| `@Query`                        | query                |
| `@Event`                        | event                |

On a method of an application service: `@CommandHandler`, `@QueryHandler`,
`@EventHandler`. They mark a behavior; what kind of message it handles is
the kind of the block it takes.

`@Actor("<name>")` on a method, or on a type for all its behaviors, names
who calls it, e.g. `@Actor("Quality manager")`; repeat it for several. Each
name becomes an actor of the model; which manual process the actor performs
and which behaviors that process invokes, a design document says.

`@Layer("<name>")` on a package's `package-info.java` puts the building
blocks of that package, and of every package below it that no nearer
`@Layer` claims, in the named layer. Without it the model has no layers.

```java
@Layer("domain")
package com.acme.shop;

import vision.noesis.annotations.Layer;
```

`@TechnicalService`, `@Actor` and `@Layer` are in the annotations after
0.1.0. Modules come from the package structure; the scanner does not read
`@Module` on `package-info.java` yet.
`${CLAUDE_PLUGIN_ROOT}/skills/implement-java-spring/references/mapping.md`
has the full rules for how code becomes the model.

## Rules and scenarios

No annotation makes a rule or a scenario. The scan reads them from the
Gherkin feature files (`*.feature`) Git tracks in the repository, run as
tests with Cucumber:

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

```java
@When("the customer places the order")
public void theCustomerPlacesTheOrder() {
    result = orders.place(customer, List.of());
}
```

- A `Rule:` is a rule, the text under it its description. It carries
  exactly one kind tag: `@validation`, `@state_change`, `@post`,
  `@computation`, `@coordination` or `@configuration`.
- A `Scenario:` or `Scenario Outline:` under it is a scenario, its steps as
  written, a `Background:` before them. A scenario outside a `Rule:` is
  not read.
- The scenario's `When` step, with the `And` and `But` steps after it,
  binds to Cucumber step definitions, `@When("…")` from
  `io.cucumber.java.en.When`, by their Cucumber expression or regular
  expression. Between them, those methods call exactly one behavior: that
  behavior governs the rule, and the rule is in its module.

The step definitions live in the test sources (`src/test/java`). The
parser reads test sources from its next release on; with a release that
reads main sources only, the scan binds no `When` step and the model has
no rules or scenarios. What the scan cannot read it drops and notes in the
service log (`.noesis/logs/noesis.log`, under `scanner`): a rule with no
kind tag or two, a `When` step matching no step definition or several,
`When` steps calling no behavior or several. A rule none of whose scenarios
binds is dropped too.

## Libraries the scan does not read

A package the code depends on (a Maven or Gradle dependency) is never parsed: the code model only
names the types the code reaches in it, with no annotations, so none of them
is a building block. When such a library holds building blocks the model
should know — a shared kernel's value objects, a platform's services —
describe it by hand in a manifest, one file per library under
`.noesis/libraries/`, committed with the code:

```json
{
  "name": "MyCompany.Shared.Kernel",
  "description": "Value types every service shares.",
  "buildingBlocks": [
    { "type": "com.mycompany.shared.Money", "kind": "value_object" },
    {
      "type": "MyCompany.Shared.Clock",
      "kind": "technical_service",
      "description": "The time now."
    }
  ]
}
```

- `name`: the library as its build names it (the package id); it becomes
  `library|<name>`.
- `type`: the type's full name as the code model spells it — namespace or
  package, then name; a nested type after a `+` (`Money+Currency`), a generic
  with its arity (`Result`1`).
- `kind`: one of the building block kinds; `name` (optional) renames the
  block, else it takes the type's own name; `description` is optional.

Each listed type becomes a building block in the module its namespace maps
to, by the same settings as the code's, and a field, parameter, result or
base typed by it now points at that block. The library contains the blocks.
A type the code itself declares is never listed: annotate it instead. The
scan reads the manifests every time and refuses an invalid one, naming the
file.
