# Noesis Java scanner

A Maven build that reads Java modules into the common **code model**: one
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
present, and it binds the JDK of the JVM that runs it. An agreement test
keeps the two engines equal up to exactly that list.

## Layout

| Path                                       | What it is                                                                                                                     |
| ------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------ |
| `annotations/`                             | `vision.noesis.annotations`: the DDD stereotype annotations a user codebase depends on                                         |
| `model/`                                   | The schema as Java records, the canonical string grammar, the JSON codec and the file layout; language-neutral                 |
| `core/`                                    | The two engines (`source/`, `bytecode/`) and what they share: ids, modifiers, constants, the stub closure, the classpath index |
| `maven-plugin/`                            | The `noesis:scan` goal: reads the module off the Maven project and writes its file and the manifest                            |
| `test-fixtures/java-syntax`                | Every Java construct the scanner maps, one file per topic; scanned by the golden tests                                         |
| `test-fixtures/java-syntax-other`          | The types the syntax fixture reaches across a module boundary                                                                  |
| `core/src/test/resources/golden/`          | The committed model files per engine                                                                                           |
| `core/src/test/resources/fixtures-broken/` | A syntax error and a missing import; must still yield a model                                                                  |
| `maven-plugin/src/it/multi-module/`        | A two-module reactor project the plugin's integration test scans with the exact invocation the service makes                   |

## Commands

From this directory:

```sh
mvn -B verify                                   # build everything, scan the fixtures, run the tests and the plugin's integration test
NOESIS_UPDATE_GOLDEN=1 mvn -B -pl core -am test  # rewrite core/src/test/resources/golden/ after an intended model change
mvn -q install -DskipTests                       # put the plugin in the local repository, which is how the service runs it
```

The fixture modules are built by the reactor before `core`'s tests scan them;
run the tests through the reactor, not with `mvn -f core/pom.xml`.

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

The service runs exactly this invocation when `noesis-config.json` says
`"scanner": "java-maven"` (`server/backend/src/adapters/out/scanners/java-maven/`),
so `mvn -q install -DskipTests` here is the one setup step.

The source engine needs Maven to run on a JDK (17 or newer); on a JRE every
module reports `NS1003`. Annotation processors are not run: members Lombok
would generate do not exist for the source engine, and calls to them are
`NS1002` diagnostics.
