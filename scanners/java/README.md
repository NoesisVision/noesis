# Noesis Java scanner

A Maven build that extracts a DDD building-block graph from compiled Java
code: aggregates, entities, services, ports, adapters, the commands, queries
and events they exchange, and the behaviours (public methods) that invoke
one another. The research and the schema are in
[`design-doc.md`](design-doc.md), which records the engine and the
graph vocabulary.

**Status: standalone, not yet integrated with the service.** The scanner
writes a JSON graph file; how that file feeds `.noesis/graph/system-models/` is a
later decision, once the file format settles. The TypeScript scanner inside `server/backend` is the only one the
service runs today.

## Modules

| Module          | Artifact                      | What it is                                                                                                                                                                                                                                                                  |
| --------------- | ----------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `annotations/`  | `noesis-annotations`          | The stereotype annotations a team can put on its classes: `@AggregateRoot`, `@Entity`, `@ValueObject`, `@Identifier`, `@DomainService`, `@ApplicationService`, `@Repository`, `@Factory`, `@Port` (with `Direction`), `@Adapter`, `@Module`, `@Command`, `@Query`, `@Event` |
| `core/`         | `noesis-scanner-core`         | The engine: ArchUnit's `ClassFileImporter` over a classes directory, stereotype detection through a configurable annotation mapping, derivers for modules, behaviours, invocations, message edges and port bindings, and a Jackson JSON writer                              |
| `maven-plugin/` | `noesis-scanner-maven-plugin` | The `noesis:scan` goal; gathers the project's inputs and calls the core                                                                                                                                                                                                     |

Group id `vision.noesis`, Java 17, version `0.1.0-SNAPSHOT`; nothing is
published to a repository yet.

## The graph

The typed vocabulary (design-doc §9.4), as the `NodeType` and
`EdgeType` enums in `core`:

- **Nodes** — grouping: `BOUNDED_CONTEXT`, `MODULE`; blocks: `AGGREGATE_ROOT`,
  `ENTITY`, `VALUE_OBJECT`, `IDENTIFIER`, `DOMAIN_SERVICE`,
  `APPLICATION_SERVICE`, `REPOSITORY`, `FACTORY`, `PORT`, `ADAPTER`;
  messages: `COMMAND`, `QUERY`, `EVENT`; and `BEHAVIOUR` (a public method,
  id `fqn#method(paramTypes)`).
- **Edges** — `CONTAINS`, `ASSOCIATION`, `INVOKES` (behaviour to behaviour),
  `SENDS` and `HANDLES` (behaviour to message), `EXPOSES`, `IMPLEMENTS`,
  `DEPENDS_ON` (block-to-block fallback).

All communication goes through message nodes; block-to-block usage is
meant to be derived downstream by lifting `INVOKES` through `CONTAINS`. The
scanner ships facts, not aggregations.

Not implemented yet: the Spoon source-fidelity pass
(positions, Javadoc, parameter names) and the Gradle plugin. `core` depends
on ArchUnit and Jackson only.

## Using the plugin

The goal binds to `process-classes` and reads the module's compiled classes:

```xml
<plugin>
  <groupId>vision.noesis</groupId>
  <artifactId>noesis-scanner-maven-plugin</artifactId>
  <version>0.1.0-SNAPSHOT</version>
  <executions>
    <execution>
      <goals><goal>scan</goal></goals>
    </execution>
  </executions>
</plugin>
```

| Parameter           | Default                                        | Meaning                    |
| ------------------- | ---------------------------------------------- | -------------------------- |
| `noesis.outputFile` | `${project.build.directory}/noesis/graph.json` | Where the graph is written |
| `noesis.skip`       | `false`                                        | Skip the scan              |

Modules with `pom` packaging and modules without compiled classes are
skipped. Multi-module aggregation is an open question (design-doc §10): today
each module writes its own graph.

## Building

Not a bun workspace member; Maven owns this directory.

```sh
mvn -B verify      # build all three modules and run the core tests
mvn -B install     # put the plugin in ~/.m2 so another build can use it
```

`core`'s test scans a fixture order-management module annotated with
`noesis-annotations` and asserts the graph it yields. CI runs `mvn verify`
in the `java-scanner` job, gated on changes under `scanners/java/**`;
Renovate groups the Maven dependency bumps into one weekly PR.
