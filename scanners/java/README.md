# Noesis Java scanner

A Maven build, plus a Gradle plugin beside it, that reads Java modules into
the common **code model**: one
JSON file per module with every package, type and member, the edges between
them (containment, inheritance, overrides, interface member mapping,
invocations, field accesses, body-level type uses) and stubs for the external
symbols it reached. The model, its ids and the mapping rules are designed in
[`docs/plans/code-model-java-scanner.md`](../../docs/plans/code-model-java-scanner.md)
on top of the model document the .NET scanner shares; the JSON Schema of
the files is generated into [`../code-model/`](../code-model/). This README is
about building and running the scanner.

Two engines read the code into the same model. The **source** engine runs
javac over the sources and is the reference: full symbol resolution, source
spans, parameter names, Javadoc, and it never fails because code does not
compile (unbound names become `unresolved` references, unbound call sites
become diagnostics). The **bytecode** engine reads the compiled classes with
ArchUnit for projects whose sources need annotation processors (Lombok); it
writes the same model with the gaps bytecode has, listed in the design
document's section 4: line-only locations, no Javadoc, parameter names only
with `-parameters`, no casts or array creations, compiler-inserted calls
present. Both engines bind the JDK API of the module's release (the bytecode
engine reads it from the running JDK's `lib/ct.sym`, as `javac --release`
does), so the model does not depend on the JDK that runs the scan. An
agreement test keeps the two engines equal up to exactly that list.

## Layout

| Path                                              | What it is                                                                                                                     |
| ------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| `annotations/`                                    | `vision.noesis.annotations`: the DDD stereotype annotations a user codebase depends on                                         |
| `model/`                                          | The schema as Java records, the canonical string grammar, the JSON codec and the file layout; language-neutral                 |
| `core/`                                           | The two engines (`source/`, `bytecode/`) and what they share: ids, modifiers, constants, the stub closure, the classpath index |
| `maven-plugin/`                                   | The `noesis:scan` goal: reads the module off the Maven project and writes its file and the manifest                            |
| `gradle-plugin/`                                  | The `vision.noesis.scanner` Gradle plugin: a `noesisScan` task that scans every Java project of a Gradle build; its own build  |
| `test-fixtures/java-syntax`                       | Every Java construct the scanner maps, one file per topic; scanned by the golden tests                                         |
| `test-fixtures/java-syntax-other`                 | The types the syntax fixture reaches across a module boundary                                                                  |
| `core/src/test/resources/golden/`                 | The committed model files per engine                                                                                           |
| `core/src/test/resources/fixtures-broken/`        | A syntax error and a missing import; must still yield a model                                                                  |
| `maven-plugin/src/it/multi-module/`               | A two-module reactor project the plugin's integration test scans with the exact invocation the service makes                   |
| `gradle-plugin/src/test/resources/multi-project/` | The same two modules as a Gradle build, scanned by the Gradle plugin's functional test                                         |

## Commands

From this directory:

```sh
mvn -B verify                                   # build everything, scan the fixtures, run the tests and the plugin's integration test
NOESIS_UPDATE_GOLDEN=1 mvn -B -pl core -am test  # rewrite core/src/test/resources/golden/ after an intended model change
mvn -q install -DskipTests                       # put the plugin in the local repository, which is how the service runs it
```

The fixture modules are built by the reactor before `core`'s tests scan them;
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
mvn -B -q -ntp -Dnoesis.out=/tmp/scan -Dnoesis.repositoryRoot=$PWD -Dnoesis.repository=my-repo \
  process-classes vision.noesis:noesis-scanner-maven-plugin:0.1.0-SNAPSHOT:scan
```

| Property                | Default                                                              | Meaning                                                                                                                   |
| ----------------------- | -------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| `noesis.out`            | `${session.executionRootDirectory}/.noesis/sessions/scanner`         | output root; files land in `code-model/java/` inside it; a relative path is taken from the execution root, not the module |
| `noesis.repositoryRoot` | `${session.executionRootDirectory}`                                  | directory file paths in the model are relative to; relative paths as for `noesis.out`                                     |
| `noesis.repository`     | the root directory's name                                            | written into the manifest                                                                                                 |
| `noesis.revision`       | `""`                                                                 | written into the manifest                                                                                                 |
| `noesis.engine`         | `source`                                                             | `source` or `bytecode`                                                                                                    |
| `noesis.release`        | `maven.compiler.release`, else `maven.compiler.target`, else the JVM | the Java release the sources are bound against                                                                            |
| `noesis.skip`           | `false`                                                              | skip this module                                                                                                          |

Every module writes `code-model/java/<artifactId>.code-model.json` and
rewrites `code-model/java/manifest.json`, which lists every module scanned so
far in reactor order; `pom` modules are skipped. The first module to run
clears the previous scan's files.

The service runs exactly this invocation when `.noesis/noesis-config.json` says
`"scanner": "java-maven"` (`server/backend/src/adapters/out/scanners/java-maven/`),
so `mvn -q install -DskipTests` here is the one setup step. Any other
invocation that writes the same files, this plugin with other flags or the
Gradle plugin below, goes in the file's `codeModel` block under
`"scanner": "code-model"`.

The source engine needs Maven to run on a JDK (17 or newer); on a JRE every
module reports `NS1003`. Annotation processors are not run: members Lombok
would generate do not exist for the source engine, and calls to them are
`NS1002` diagnostics.

## Running the Gradle plugin

The plugin id is `vision.noesis.scanner`, published to the local repository
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
    id 'vision.noesis.scanner' version '0.1.0-SNAPSHOT'
}

noesis {
    engine = 'bytecode'   // for a build whose sources need annotation processors (Lombok)
}
```

`./gradlew noesisScan` then compiles every project with the `java` plugin and
scans them all in one go, in dependency order, into one manifest. The
settings of the `noesis { }` block are the Maven plugin's properties, and a
Gradle property of the same name overrides each of them, so a command line
sets a scan up without touching the build:

```sh
./gradlew -q noesisScan -Pnoesis.out=/tmp/scan -Pnoesis.repositoryRoot=$PWD -Pnoesis.repository=my-repo
```

| Setting                 | Default                                                                | Meaning                                                                               |
| ----------------------- | ---------------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| `noesis.out`            | `.noesis/sessions/scanner` in the root project                         | output root; files land in `code-model/java/` inside it; relative to the root project |
| `noesis.repositoryRoot` | the root project's directory                                           | directory file paths in the model are relative to                                     |
| `noesis.repository`     | the repository root's directory name                                   | written into the manifest                                                             |
| `noesis.revision`       | `""`                                                                   | written into the manifest                                                             |
| `noesis.engine`         | `source`                                                               | `source` or `bytecode`                                                                |
| `noesis.release`        | the compile task's `release`, else `targetCompatibility`, else the JVM | the Java release the sources are bound against                                        |

The service runs the task when `.noesis/noesis-config.json` says so; `{out}`,
`{root}` and `{name}` are filled in with the session directory, the
repository root and its name:

```json
{
  "scanner": "code-model",
  "codeModel": {
    "command": [
      "./gradlew",
      "-q",
      "noesisScan",
      "-Pnoesis.out={out}",
      "-Pnoesis.repositoryRoot={root}",
      "-Pnoesis.repository={name}"
    ]
  }
}
```

A project is named by its Gradle project name (`A:app`), a sibling project on
the compile classpath is a `source` dependency, a module a `library` by its
coordinates; the main class comes from the `application` plugin, Spring
Boot's `springBoot.mainClass` or the jar manifest's `Main-Class`. The task is
up to date while the sources, the classpath and the settings are unchanged.
The Gradle daemon must run on a JDK, as Maven must; the engines run inside
it.
