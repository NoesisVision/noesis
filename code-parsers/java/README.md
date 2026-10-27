# Noesis Java parser

A Maven build, plus a Gradle plugin beside it, that reads Java modules into
the common **code model**: one
JSON file per module with every package, type and member, the edges between
them (containment, inheritance, overrides, interface member mapping,
invocations, field accesses, body-level type uses) and stubs for the external
symbols it reached. The model, its ids and the mapping rules are designed in
[`docs/plans/code-model-java-parser.md`](../../docs/plans/code-model-java-parser.md)
on top of the model document the .NET parser shares. This README is about
building and running the parser.

Two engines read the code into the same model. The **source** engine runs
javac over the sources and is the reference: full symbol resolution, source
spans, parameter names, Javadoc, and it never fails because code does not
compile (unbound names become `unresolved` references, unbound call sites
become diagnostics). The **bytecode** engine reads the compiled classes with
ArchUnit for projects whose sources need annotation processors (Lombok); it
writes the same model with the gaps bytecode has, listed in the design
document's section 4: line-only locations, no Javadoc, parameter names only
with `-parameters`, no casts or array creations, compiler-inserted calls
present. The **hybrid** engine runs both and merges them by id (section 4a):
the source model whole, plus the members a processor generated and the calls
to them from the class files, each marked `java.engine: bytecode`. Every
engine binds the JDK API of the module's release (the bytecode engine reads
it from the running JDK's `lib/ct.sym`, as `javac --release` does), so the
model does not depend on the JDK that runs the parse. An agreement test keeps
the source and the bytecode engine equal up to exactly that list, a
committed report counts every difference from the source engine by category
for every engine, and the `*FactsTest` classes pin the facts the .NET
parser's tests pin, against every engine that holds them.

## Layout

| Path                                               | What it is                                                                                                                               |
| -------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| `annotations/`                                     | `vision.noesis.annotations`: the DDD stereotype annotations a user codebase depends on                                                   |
| `model/`                                           | The schema as Java records, the canonical string grammar, the JSON codec and the file layout; language-neutral                           |
| `core/`                                            | The engines (`source/`, `bytecode/`, `hybrid/`) and what they share: ids, modifiers, constants, the stub closure, the classpath index    |
| `maven-plugin/`                                    | The `noesis:parse` goal: reads the module off the Maven project and writes its file and the manifest                                     |
| `gradle-plugin/`                                   | The `vision.noesis.parser` Gradle plugin: a `noesisParse` task that parses every Java project of a Gradle build; its own build           |
| `test-fixtures/java-syntax`                        | Every Java construct the parser maps, one file per topic, mirroring the .NET parser's `CSharpSyntax` fixture; parsed by the golden tests |
| `test-fixtures/java-syntax-other`                  | The types the syntax fixture reaches across a module boundary                                                                            |
| `test-fixtures/java-lombok`                        | Classes whose members Lombok generates and the code that calls them: what the hybrid engine adds to the source model                     |
| `core/src/test/resources/golden/`                  | The committed model files per engine, and `engine-comparison.md`, the counted difference of every engine from the source engine          |
| `core/src/test/resources/fixtures-broken/`         | A syntax error and a missing import; must still yield a model                                                                            |
| `maven-plugin/src/it/multi-module/`                | A two-module reactor project the plugin's integration test parses with the exact invocation the service makes                            |
| `maven-plugin/src/it/broken-reactor/`              | A reactor whose first module does not compile, parsed with `-Dmaven.compiler.failOnError=false`: both modules get a model                |
| `gradle-plugin/src/test/resources/multi-project/`  | The same two modules as a Gradle build, parsed by the Gradle plugin's functional test                                                    |
| `gradle-plugin/src/test/resources/broken-project/` | A project that does not compile, parsed past its compile error by `noesisParse`                                                          |

## Commands

From this directory:

```sh
mvn -B verify                                   # build everything, parse the fixtures, run the tests and the plugin's integration test
NOESIS_UPDATE_GOLDEN=1 mvn -B -pl core -am test  # rewrite core/src/test/resources/golden/ after an intended model change
mvn -q install -DskipTests                       # put the plugin in the local repository, which is how the service runs it
```

The fixture modules are built by the reactor before `core`'s tests parse them;
run the tests through the reactor, not with `mvn -f core/pom.xml`.

The Gradle plugin is a Gradle build of its own, because the Gradle API is not
on Maven Central; it takes `core` from the local repository, so `mvn install`
comes first. From `gradle-plugin/`:

```sh
./gradlew build                 # compile, validate the plugin, run the functional test on the fixture build
./gradlew publishToMavenLocal   # put the plugin in the local repository, where a Gradle build finds it
```

## Running the plugin

The plugin is bound to `process-classes`, so the module and the reactor
siblings it depends on are compiled. On any Maven project, without touching
its POM:

```sh
mvn -B -q -ntp -Dnoesis.out=/tmp/parse -Dnoesis.repositoryRoot=$PWD -Dnoesis.repository=my-repo \
  process-classes vision.noesis:noesis-parser-maven-plugin:0.1.0-SNAPSHOT:parse
```

| Property                | Default                                                                             | Meaning                                                                                                                   |
| ----------------------- | ----------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| `noesis.out`            | `${session.executionRootDirectory}/.noesis/tmp/parser`                              | output root; files land in `code-model/java/` inside it; a relative path is taken from the execution root, not the module |
| `noesis.repositoryRoot` | `${session.executionRootDirectory}`                                                 | directory file paths in the model are relative to; relative paths as for `noesis.out`                                     |
| `noesis.repository`     | the root directory's name                                                           | written into the manifest                                                                                                 |
| `noesis.revision`       | `""`                                                                                | written into the manifest                                                                                                 |
| `noesis.engine`         | `source`                                                                            | `source`, `bytecode` or `hybrid`                                                                                          |
| `noesis.release`        | the compiler plugin's `release`, else its `target`, else its `source`, else the JVM | the Java release the sources are bound against                                                                            |
| `noesis.skip`           | `false`                                                                             | skip this module                                                                                                          |

Each of the compiler plugin's `release`, `target` and `source` is read as
the compiler plugin reads it: the `default-compile` execution's
`<configuration>`, else the plugin's, else the `maven.compiler.*` property,
from the command line before the POM. A `release` set anywhere wins over a
`target`, as it does for the compiler.

Every module writes `code-model/java/<artifactId>.code-model.json` and
rewrites `code-model/java/manifest.json`, which lists every module parsed so
far in reactor order; `pom` modules are skipped. Nothing is deleted: a
reader reads only the files the manifest lists, and the service parses into a
fresh directory that it removes once it has read the model.

### Parsing from the service

A repository declares the plugin in its POM, with the settings it needs in
the plugin's `<configuration>`, so the build pins the version and the engine:

```xml
<plugin>
  <groupId>vision.noesis</groupId>
  <artifactId>noesis-parser-maven-plugin</artifactId>
  <version>0.1.0-SNAPSHOT</version>
  <configuration>
    <engine>hybrid</engine>
  </configuration>
</plugin>
```

Declared there, the goal has the short name `noesis:parse`. The repository's
`.noesis/settings.json` gives the service the command that runs it, in
`"parser": { "language": "java", … }`; the service fills in `{out}` with a fresh
directory and `{name}` with the repository's name:

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
    ]
  }
}
```

`-Dmaven.compiler.failOnError=false` belongs to the compiler plugin, so it
goes on the command line, not into the Noesis plugin's configuration. With
it a compile error does not stop the parse: the module is parsed from its
sources, with the compiler's errors in its model. A module whose compile
failed has no classes, so the modules that depend on it bind its types as
unresolved. Any other failure of the build fails the parse. Until the plugin
is published, `mvn -q install -DskipTests` here puts it in the local
repository, where the build finds it.

The source engine needs Maven to run on a JDK (17 or newer); on a JRE every
module reports `NS1003`. Annotation processors are not run: members Lombok
would generate do not exist for the source engine, and calls to them are
`NS1002` diagnostics; `-Dnoesis.engine=hybrid` takes those members and calls
from the compiled classes and keeps everything else from the sources.

## Running the Gradle plugin

The plugin id is `vision.noesis.parser`, published to the local repository
by `./gradlew publishToMavenLocal` in `gradle-plugin/`. A build applies it
once, in the root build file or in any project's (the task is registered on
the root project either way), with `mavenLocal()` among the plugin
repositories of its settings file:

```groovy
// settings.gradle
pluginManagement {
    repositories {
        mavenLocal()
        gradlePluginPortal()
    }
}

// build.gradle
plugins {
    id 'vision.noesis.parser' version '0.1.0-SNAPSHOT'
}

noesis {
    engine = 'hybrid'   // for a build whose sources need annotation processors (Lombok); 'bytecode' reads the classes alone
}
```

`./gradlew noesisParse` then compiles every project with the `java` plugin and
parses them all in one go, in dependency order, into one manifest. The
settings of the `noesis { }` block are the Maven plugin's properties, and a
Gradle property of the same name overrides each of them, so a command line
sets a parse up without touching the build:

```sh
./gradlew -q noesisParse -Pnoesis.out=/tmp/parse -Pnoesis.repositoryRoot=$PWD -Pnoesis.repository=my-repo
```

| Setting                 | Default                                                                | Meaning                                                                               |
| ----------------------- | ---------------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| `noesis.out`            | `.noesis/tmp/parser` in the root project                               | output root; files land in `code-model/java/` inside it; relative to the root project |
| `noesis.repositoryRoot` | the root project's directory                                           | directory file paths in the model are relative to                                     |
| `noesis.repository`     | the repository root's directory name                                   | written into the manifest                                                             |
| `noesis.revision`       | `""`                                                                   | written into the manifest                                                             |
| `noesis.engine`         | `source`                                                               | `source`, `bytecode` or `hybrid`                                                      |
| `noesis.release`        | the compile task's `release`, else `targetCompatibility`, else the JVM | the Java release the sources are bound against                                        |

A build that asks for `noesisParse` compiles past compile errors: no
`JavaCompile` task fails, and each project is parsed from its sources with
the compiler's errors in its model. Any other build (`./gradlew build`, or
`classes` alone) compiles as the build says.

The service runs the task through the repository's `.noesis/settings.json`;
`{out}`, `{root}` and `{name}` are filled in with the session directory, the
repository root and its name:

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
    ]
  }
}
```

A project is named by its Gradle project name (`A:app`), or by its path (`A:billing:api`) when another project of the build has the same name; a sibling project on
the compile classpath is a `source` dependency, a module a `library` by its
coordinates; the main class comes from the `application` plugin, Spring
Boot's `springBoot.mainClass` or the jar manifest's `Main-Class`. The task is
up to date while the sources, the compiled classes, the classpath and the
settings are unchanged.
The Gradle daemon must run on a JDK, as Maven must; the engines run inside
it.

## Releasing to Maven Central

A `java-v<version>` tag (`java-v0.1.0`) runs
[`.github/workflows/release-java.yml`](../../.github/workflows/release-java.yml),
which publishes that version under the verified `vision.noesis` namespace.
The repository stays on `0.1.0-SNAPSHOT`: the workflow sets the version from
the tag (`mvn versions:set`, `-Pversion=` for Gradle) and publishes in two
steps:

1. `mvn -P release deploy` here: the parent POM, `noesis-annotations`,
   `noesis-parser-model`, `noesis-parser-core` and
   `noesis-parser-maven-plugin`, each with sources, javadoc and a signature,
   through Sonatype's `central-publishing-maven-plugin`. It waits until
   Central serves them. The test fixtures are not published.
2. `./gradlew publishAndReleaseToMavenCentral` in `gradle-plugin/`: the
   Gradle plugin and its marker (`vision.noesis.parser:vision.noesis.parser.gradle.plugin`),
   through `com.vanniktech.maven.publish`. A build applies it from
   `mavenCentral()` among its plugin repositories.

Tests do not run in the release: the core's tests pin the `-SNAPSHOT`
version, so tag a commit the CI's Java parser job has passed. A version on
Central can never be replaced or removed.

The workflow reads four repository secrets: `CENTRAL_USERNAME` and
`CENTRAL_PASSWORD`, a user token from central.sonatype.com, and
`GPG_PRIVATE_KEY` (armored) with `GPG_PASSPHRASE`, a key whose public half is
on `keyserver.ubuntu.com`. To build the signed bundle locally without
uploading it, put a key in `MAVEN_GPG_KEY` and `MAVEN_GPG_PASSPHRASE` and run
`mvn -P release -DskipTests -Dinvoker.skip=true -DskipUpload=true deploy` on a
release version; the bundle lands in `target/central-publishing/`.
