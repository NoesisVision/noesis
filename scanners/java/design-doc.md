# Java Scanner — Design Doc

Status: **Decided** — ArchUnit importer as the engine, Spoon for source fidelity (`docs/decisions.md` #19); graph schema is variant B modified — messages + behaviour-level invocation (#20, §9.4).
Date: 2026-06-10

## 1. Goal

A Java code scanner that extracts a graph from a codebase:

- **Objects** — classes, interfaces, enums, records, methods, constructors, fields, annotations, packages.
- **Behaviours** — method calls, constructor calls (instantiations), field reads/writes, method references.
- **Relations** — inheritance (`extends`/`implements`), containment (package → class → member), dependencies (field/parameter/return/throws/annotation types).

The scanner runs inside the user's build as a **Maven plugin and a Gradle plugin**, serializes the graph to JSON conforming to a Noesis contract schema, and ships it to the backend (`POST` to `apps/server` REST API), which loads it into the embedded graph DB (see `docs/decisions.md` #17). The scanner never talks to the DB directly.

## 2. Requirements

| #   | Requirement                                                      | Notes                                                         |
| --- | ---------------------------------------------------------------- | ------------------------------------------------------------- |
| R1  | Extract objects, behaviours, relations listed above              | Core                                                          |
| R2  | Distributable as Maven plugin **and** Gradle plugin              | Maven Central + Gradle Plugin Portal                          |
| R3  | Permissive licensing                                             | Scanner is redistributed; copyleft (GPL) engines are a hazard |
| R4  | Stable, maintained foundation                                    | Must keep up with new Java versions                           |
| R5  | Reasonable performance on large codebases (thousands of classes) | Runs in CI builds                                             |
| R6  | Output is build-tool-agnostic JSON                               | Same contract as the future .NET scanner                      |

Nice-to-have (drives the source-vs-bytecode tradeoff): source positions, comments/Javadoc, parameter names.

## 3. Proposed approach: ArchUnit as the scanning platform

[ArchUnit](https://www.archunit.org) (`com.tngtech.archunit:archunit`) is an architecture-testing library, but its **import layer is a standalone, public, stable code-analysis platform** that we can reuse without the rule/test machinery.

### What we get

- **Entry point**: `ClassFileImporter` → `JavaClasses`. Imports from packages, paths, JARs, or the classpath, with filtering via `ImportOption` (e.g. `DoNotIncludeTests`).
- **Objects**: `JavaClass`, `JavaPackage`, `JavaField`, `JavaMethod`, `JavaConstructor`, `JavaStaticInitializer`, `JavaParameter`, `JavaAnnotation` (with structured values and meta-annotations), `JavaModifier`, `JavaEnumConstant`. Full declaration-site generics model (`JavaParameterizedType`, `JavaTypeVariable`, `JavaWildcardType`).
- **Behaviours**: the `JavaAccess` hierarchy — `JavaMethodCall`, `JavaConstructorCall` (instantiations), `JavaFieldAccess` (with read/write `AccessType`), `JavaMethodReference`/`JavaConstructorReference` — each with origin code unit, target, and line number. Lambda bodies are attributed to the declaring method (`isDeclaredInLambda()`).
- **Relations**: inheritance (superclass/interfaces/subclasses), containment (members, inner classes, package tree), and a unified `Dependency` abstraction (`getDirectDependenciesFromSelf/ToSelf`) covering extends/implements, field/parameter/return/throws/annotation types, accesses, `instanceof`, class literals. All relations are bidirectional (`...fromSelf` / `...toSelf`).

This maps almost 1:1 onto our objects/behaviours/relations model — the extraction step becomes a straightforward walk over `JavaClasses` emitting JSON.

### Practicalities

- **License**: Apache 2.0. **Dependencies**: a single JAR that shades everything (ASM, Guava) except `slf4j-api` — no classpath conflicts inside Maven/Gradle plugin classloaders, which matters a lot for build plugins.
- **Stability**: the importer and domain model are explicitly marked `@PublicAPI`, enforced by ArchUnit's own architecture tests. Latest release 1.4.2 (2026-04-18) supports class files up to Java 26; runs on Java 8+.
- **Precedent**: [Spring Modulith](https://spring.io/blog/2022/10/21/introducing-spring-modulith/) builds its entire application-module model on ArchUnit's importer; [archifacts](https://github.com/archifacts/archifacts) (Apache-2.0) extracts building blocks + relationships from it for documentation. The importer is a proven standalone platform, not just test plumbing.
- **No official build plugins**: ArchUnit is library-only. We build our own Mojo/Gradle task (which we want anyway — see §6). The third-party [societe-generale arch-unit-maven-plugin](https://github.com/societe-generale/arch-unit-maven-plugin) shows the integration pattern but solves a different problem (running rules).

### Limitations / risks

| Risk                           | Detail                                                                                                                                                                                                                                                              | Mitigation                                                                                                                                                                            |
| ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Bytecode only                  | Needs **compiled classes**; no comments/Javadoc; **no parameter names** (`JavaParameter` has no `getName()`, even with `-parameters` — [TNG/ArchUnit#1230](https://github.com/TNG/ArchUnit/issues/1230)); line numbers only (no columns), call-site generics erased | Run the scan after `compile`/`classes` task — natural in a build plugin. Comments/positions/names come from the complementary Spoon source pass (§7), keyed by FQN                    |
| Memory/time on large codebases | Known OOM reports on ~1000+ classes with classpath resolution and access-heavy analysis ([#214](https://github.com/TNG/ArchUnit/issues/214), [#399](https://github.com/TNG/ArchUnit/issues/399)); JUnit-runner caching doesn't apply to standalone importer use     | Tune `ClassResolver` / disable `resolveMissingDependenciesFromClassPath`; scan module-by-module in multi-module builds; stream JSON out rather than holding the full export in memory |
| Metamodel not extensible       | Domain classes are `final`; no import-pipeline plugin point                                                                                                                                                                                                         | We don't need to extend it — we **wrap and map** to our own contract schema (same approach as Spring Modulith)                                                                        |
| Unresolved access targets      | An access target may resolve to 0..n members (inheritance/diamond)                                                                                                                                                                                                  | Contract schema must represent unresolved/ambiguous targets explicitly                                                                                                                |

## 4. Alternatives

### Alternative 1 — jQAssistant (off-the-shelf code graph)

[jQAssistant](https://jqassistant.org) scans bytecode (also POMs, XML, YAML…) directly into an embedded Neo4j graph: `:Class`, `:Method`, `:Field` nodes with `INVOKES`, `READS`, `WRITES`, `EXTENDS`, `IMPLEMENTS`, `DEPENDS_ON` relationships — conceptually the closest existing product to what we're building. Active (2.9.1 stable, 2.10.0-M2 Feb 2026), official Maven plugin + CLI, extensible scanner SPI.

**Why not**:

- **GPLv3.** Embedding its scanner in a redistributed plugin would pull our distribution under GPLv3; the only safe pattern is process isolation around its CLI, which means we'd inherit its Neo4j store and then have to re-extract via Cypher into our contract — an awkward double hop.
- **No official Gradle support**; the community Gradle plugin ([kontext-e](https://github.com/kontext-e/jqassistant-gradle-plugin)) requires a local installation and is stale (last commit 2025-05). R2 fails out of the box.
- Heavy footprint (embedded Neo4j) for what is, for us, just an extraction step — we already have our own graph store.

Verdict: great validation that the graph shape is right (their node/edge taxonomy is worth borrowing for our schema), wrong foundation to embed.

### Alternative 2 — Spoon (source-based metamodel)

[Spoon](https://github.com/INRIA/spoon) (INRIA, dual CeCILL-C / **MIT**) builds a typed source metamodel (`CtClass`, `CtMethod`, `CtInvocation`, `CtConstructorCall`, …) on top of the Eclipse JDT compiler, with semantic references, a query API (`CtScanner`, `Filter`), and a distinctive **no-classpath mode** that produces a best-effort model even with missing dependencies. Active (11.3.x, commits June 2026, Java 25 support).

- **Pros**: everything ArchUnit can't give us — exact source positions, comments/Javadoc, parameter names; works without compilation; MIT option is embedding-clean.
- **Cons**: noticeably slower and more memory-hungry than bytecode scanning; heavy dependency (drags in JDT core, unshaded — classloader hygiene inside Maven/Gradle plugins becomes our problem); stable releases are infrequent (fixes live in the beta stream); model is build-from-source, so generated/bytecode-only artifacts are invisible.

Verdict: the strongest alternative if source fidelity (positions, comments, names) becomes a first-class requirement. More integration effort and slower scans than ArchUnit.

### Alternative 3 — Roll-your-own on ASM (bytecode, maximal control)

[OW2 ASM](https://asm.ow2.io) (BSD-3, 9.10.1 May 2026, tracks every new JDK within weeks) is what ArchUnit and jQAssistant use internally. A `ClassVisitor`/`MethodVisitor` pass yields every raw fact we need (classes, members, `INVOKE*`, `NEW`, field access, hierarchy, annotations) at maximal speed and minimal footprint.

- **Pros**: total control over the model and memory profile; fastest option; trivially shadeable; no abstraction mismatch with our contract schema.
- **Cons**: we re-implement what ArchUnit already solved — generic-signature parsing, bridge/synthetic-method filtering, lambda/`invokedynamic` attribution, target resolution across inheritance. That's real, ongoing maintenance for zero product differentiation. Same bytecode-level information losses as ArchUnit.

Verdict: the fallback if ArchUnit's model or performance ever becomes a hard blocker — not the starting point.

### Honourable mentions (considered, not shortlisted)

- **JavaParser + JavaSymbolSolver** (Apache-2.0 option, very active) — source AST with symbol resolution; lighter than Spoon but resolution throws on missing classpath entries, so a robust scanner must handle per-node failures. Best kept as the _complementary source pass_ for comments/positions on top of a bytecode scan.
- **OpenRewrite LST** — type-attributed lossless source trees, Apache-2.0 core; its [rewrite-maven-plugin](https://docs.openrewrite.org/reference/rewrite-maven-plugin) / [rewrite-gradle-plugin](https://github.com/openrewrite/rewrite-gradle-plugin) pair is our **architecture template** (§6) even if we don't use the LST. Recipe relicensing (Moderne source-available) makes the periphery worth watching.
- **CodeQL** — engine license restricts analysis to OSS/academic use without a commercial GitHub license; disqualified for a redistributable scanner.
- **joern** (CPG, Apache-2.0) — multi-language code property graph; Scala stack, not realistically embeddable in build plugins, but its CPG schema is good prior art for ours.
- **scip-java** (Apache-2.0) — precise defs/refs via a compiler plugin hooked into the build; flat index, no direct call edges; interesting "wrap the user's compiler" technique.

## 5. Comparison

|                                    | **ArchUnit (proposed)**    | jQAssistant                  | Spoon                     | ASM roll-your-own            |
| ---------------------------------- | -------------------------- | ---------------------------- | ------------------------- | ---------------------------- |
| Analysis level                     | Bytecode                   | Bytecode                     | Source (JDT)              | Bytecode                     |
| Graph coverage (R1)                | Full, ready-made metamodel | Full, ready-made Neo4j graph | Full + source fidelity    | Full, but we build the model |
| License (R3)                       | Apache 2.0 ✅              | **GPLv3** ❌                 | MIT option ✅             | BSD-3 ✅                     |
| Maven+Gradle embedding (R2)        | Single shaded JAR ✅       | Official Maven only ❌       | Heavy, unshaded JDT ⚠️    | Tiny ✅                      |
| Maintenance (R4)                   | Active, Java 26            | Active                       | Active, betas carry fixes | Extremely active             |
| Performance (R5)                   | Good; OOM risk at scale ⚠️ | Good                         | Slowest ⚠️                | Best                         |
| Comments / positions / param names | ❌ / line-only / ❌        | ❌ / line-only / ❌          | ✅ / exact / ✅           | ❌ / line-only / ❌          |
| Engineering effort                 | **Low** (map model → JSON) | Medium + license trap        | Medium                    | High                         |

## 6. Plugin architecture (applies regardless of engine)

Three artifacts, following the OpenRewrite / SpotBugs pattern:

```
scanners/java/
├── scanner-core/      # plain JAR, zero build-tool deps
│                      #   in:  class dirs (+ optionally source roots) + classpath
│                      #   out: graph JSON matching the Noesis contract schema
├── maven-plugin/      # maven-plugin packaging, @Mojo "scan" goal,
│                      #   classpath via project.getCompileClasspathElements()
└── gradle-plugin/     # java-gradle-plugin + com.gradle.plugin-publish,
                       #   reads sourceSets.main.compileClasspath,
                       #   runs scan via Worker API (classloader isolation)
```

Rules of the pattern:

- **The engine choice is invisible above `scanner-core`** — the Maven/Gradle adapters only gather inputs and invoke the core. Swapping ArchUnit for ASM/Spoon later doesn't touch the plugins.
- Both plugins run the scan in an **isolated classloader/worker** (SpotBugs Worker-API style) so the engine never clashes with the build tool's classpath. ArchUnit's fully-shaded JAR makes this easy.
- Scan binds **after compilation** (Maven: `verify`-adjacent phase after `compile`; Gradle: task wired `dependsOn(classes)`).
- Output: JSON file (`build/noesis/graph.json` / `target/noesis/graph.json`) + optional direct upload to the Noesis server (URL/token via plugin config). The JSON contract is the same one the .NET scanner will use — defined as zod schemas in `packages/` per the existing contract pattern, with a JSON Schema export for the Java side to validate against.
- Releases: tag-driven GitHub Actions to Maven Central + Gradle Plugin Portal, mirroring the npm plugin release flow.

## 7. Decision (decisions.md #19)

**ArchUnit's `ClassFileImporter` is the primary engine inside `scanner-core`** — best effort-to-coverage ratio: Apache-2.0, single shaded dependency, `@PublicAPI`-stable, proven standalone by Spring Modulith, and its metamodel maps directly onto our objects/behaviours/relations.

**Spoon provides the source-fidelity enrichment pass** — exact source positions, comments/Javadoc, and parameter names, merged into the graph as **optional fields keyed by FQN + member descriptor**. Spoon over JavaParser because of its no-classpath mode (best-effort model instead of resolution exceptions) and the MIT license option. The pass may be skipped or partial; the contract schema must treat its fields as optional. Because Spoon's JDT dependency is unshaded, the classloader isolation in §6 is mandatory.

The architecture in §6 keeps both engines replaceable (e.g. ASM if performance bites) — nothing above `scanner-core` knows which engines run.

## 8. Why a graph — purpose and scope

The graph exists to **visually represent system structure in DDD terms**, not to mirror the codebase. Its nodes are **DDD building blocks** — the tactical patterns (aggregate root, entity, value object, domain event, domain service, application service, repository, factory) — plus the **hexagonal infrastructure blocks**: **ports** (interfaces the domain exposes or requires) and **adapters** (implementations binding ports to technology). Edges are the architecturally meaningful relations between them.

How blocks are found: **developers annotate building-block classes**, and the scanner detects the annotations in ArchUnit's graph (`JavaClass.getAnnotations()`, including meta-annotations) — detection is explicit opt-in, not heuristic. Relations are then **derived** from ArchUnit's dependency model _between annotated classes_: a field of another aggregate's type becomes an association, a class implementing a port interface becomes the port's adapter, a constructor call of a domain-event type becomes an emission.

**Annotation source — prefer jMolecules over inventing our own.** [jMolecules](https://github.com/xmolecules/jmolecules) (Apache-2.0) provides exactly this vocabulary: `@AggregateRoot`, `@Entity`, `@ValueObject`, `@DomainEvent`, `@Service`, `@Repository`, `@Factory` (`jmolecules-ddd`, `jmolecules-events`) and `@PrimaryPort`/`@SecondaryPort`/`@PrimaryAdapter`/`@SecondaryAdapter` (`jmolecules-architecture` hexagonal module), and it already has ArchUnit integration. The scanner should ship a **configurable stereotype mapping** (annotation FQN → stereotype) with the jMolecules mapping built in, so teams with their own annotations just add config.

Consequences for the schema:

- **Granularity is building-block-level, not class-level** — hundreds of nodes for a large system, not tens of thousands. Helper classes without (and not reachable from) a stereotype are invisible.
- Nodes need what a diagram needs: name, stereotype, grouping (bounded context / module), and a stable id (FQN) so successive scans diff cleanly.
- Edges must be typed well enough to render distinct arrows (containment vs. association vs. event flow vs. port binding).
- Non-goals (for now): full code search, dependency audits, method-level navigation — these would force class-level granularity and are explicitly variant C territory below.

## 9. Graph schema — three variants

All three share the same envelope: `{ scan: { tool, version, timestamp, module }, nodes: [...], edges: [...] }`, ids are FQNs, and zod schemas in `packages/` remain the single source of truth (JSON Schema exported for the Java side, per §6).

### Variant A — generic property graph (open vocabulary)

One node shape, one edge shape; stereotypes and relation kinds are plain strings.

```jsonc
{ "id": "com.shop.order.Order",
  "label": "Order",
  "stereotype": "AGGREGATE_ROOT",        // open string vocabulary
  "group": "com.shop.order",             // module / bounded context
  "source": { "file": "Order.java", "line": 14 },
  "props": { "javadocSummary": "..." } } // free-form, Spoon-fed
{ "from": "com.shop.order.Order", "to": "com.shop.customer.Customer",
  "kind": "ASSOCIATION", "props": {} }
```

- **Pros:** schema never changes when stereotypes grow; trivially shared with the .NET scanner; custom team annotations map straight through; server/DB stay dumb.
- **Cons:** the vocabulary lives in convention, not in the contract — typos ship silently; the visualizer needs its own stereotype registry to render anything meaningfully; kind-specific data (e.g. port direction) hides untyped in `props`.

### Variant B — strongly-typed DDD/hexagonal schema (closed vocabulary)

Zod discriminated unions; every building block and relation is a contract type.

```text
nodes (discriminated on `type`):
  BoundedContext | Module
  AggregateRoot | Entity | ValueObject | Identifier
  DomainEvent | DomainService | ApplicationService | Repository | Factory
  Port    { direction: "primary" | "secondary" }
  Adapter { direction: "primary" | "secondary" }

edges (discriminated on `type`):
  CONTAINS        module → block, aggregate → entity/VO
  ASSOCIATION     aggregate → aggregate (by id reference)
  USES            block → block (method-call dependency)
  EMITS           block → DomainEvent
  LISTENS_TO      block → DomainEvent
  EXPOSES         module → Port
  IMPLEMENTS      Adapter → Port
  DEPENDS_ON      fallback for any remaining annotated-to-annotated dependency
```

- **Pros:** the contract _is_ the ubiquitous language — invalid graphs are rejected at ingest; the visualizer can give every type bespoke rendering (port lollipops, event arrows) without a side registry; kind-specific fields (port direction) are first-class and validated.
- **Cons:** every new stereotype is a schema + scanner + server change shipped in lock-step; custom team annotations must map onto _our_ closed set or be dropped; risk of modeling debates freezing progress.

### Variant C — layered graph (architecture layer over code layer)

Two node layers in one graph, jQAssistant/CPG-style. Layer 0 is the raw code graph (classes, interfaces, methods; `EXTENDS`/`IMPLEMENTS`/`CALLS`/`READS_WRITES` edges — straight from ArchUnit). Layer 1 is the building-block graph (as in B), where each block node points at its code via `REALIZES` edges and **every derived architectural edge carries evidence** — the layer-0 edges that justify it.

```jsonc
{
  "from": "com.shop.order.Order",
  "to": "com.shop.customer.Customer",
  "type": "ASSOCIATION",
  "evidence": [
    "call:OrderService.place/Order.customerId",
    "field:Order.customerId",
  ],
}
```

- **Pros:** drill-down visualization (context → blocks → classes → methods) from one payload; architectural edges are explainable ("why does Order depend on Customer?"); layer 1 can be **re-derived server-side** when derivation rules improve, without re-scanning.
- **Cons:** payload jumps from hundreds to tens of thousands of nodes — the R5 performance risks (ArchUnit OOM, streaming) become acute; server ingest and the graph DB must handle class-level volume on day one; most of layer 0 is never rendered; ambiguous access targets (0..n resolution) now need explicit representation.

### Comparison and recommendation

| Criterion          | A — generic         | B — typed                 | C — layered              |
| ------------------ | ------------------- | ------------------------- | ------------------------ |
| Contract safety    | weak (strings)      | **strong**                | strong (B + code layer)  |
| Visualizer effort  | high (own registry) | **low**                   | low, drill-down possible |
| Schema evolution   | free                | lock-step releases        | lock-step + volume       |
| Custom annotations | native              | via mapping to closed set | via mapping              |
| Payload size (R5)  | small               | **small**                 | large                    |
| .NET scanner reuse | trivial             | shared closed set works   | heavy                    |

Recommendation was Variant B with C's `evidence` field borrowed (optional `evidence: string[]` on derived edges — human-readable code references, not layer-0 node ids): strongest contract and smallest payload for the stated visualization purpose, with a clean upgrade path (layer 0 can be added later as a separate contract). **Decided — see §9.4.**

### 9.4 Decided schema — Variant B, modified (decisions.md #20)

Variant B as above, with three modifications:

1. **All communication is modeled as messages.** Three message node types: **`Command`**, **`Query`**, **`Event`** (replacing B's lone `DomainEvent`). A message is itself an annotated class; communication edges point at message nodes, never directly block-to-block.
2. **Building blocks have behaviours.** A **`Behaviour`** node is an operation of a building block (a public method — e.g. `Order#place`, `OrderAppService#handle(PlaceOrder)`), owned via `CONTAINS`. An `ApplicationService` exposes its message handlers as behaviours: a behaviour with a `HANDLES` edge to a `Command`, `Query`, or `Event`.
3. **Invocation is behaviour-level.** **`INVOKES`** edges connect behaviours (replacing B's block-level `USES`). Block-to-block usage is not stored — the server derives it by lifting `INVOKES` through `CONTAINS` when a coarser view is rendered.

```text
nodes (discriminated on `type`):
  grouping:   BoundedContext | Module                 // package-backed, not class-backed
  blocks:     AggregateRoot | Entity | ValueObject | Identifier
              DomainService | ApplicationService | Repository | Factory
              Port    { direction: "primary" | "secondary" }
              Adapter { direction: "primary" | "secondary" }
  messages:   Command | Query | Event                 // class-backed, own category
  behaviour:  Behaviour { name, signature }           // method-backed, id = "fqn#method(paramTypes)"

type aliases (zod unions, not node types):
  block   = any node in the `blocks` category (one node per annotated class)
  message = Command | Query | Event

edges (discriminated on `type`; derived edges carry optional evidence: string[]):
  CONTAINS     module → block | message · aggregate → entity/VO · block → Behaviour
  ASSOCIATION  aggregate → aggregate (by id reference)
  INVOKES      Behaviour → Behaviour
  SENDS        Behaviour → message   (producer side)
  HANDLES      Behaviour → message   (consumer side)
  EXPOSES      module → Port
  IMPLEMENTS   Adapter → Port
  DEPENDS_ON   block → block (fallback for non-behavioural dependencies, e.g. type-only)
```

A **block** is a node backed by a single annotated class — the structural stereotypes including ports and adapters. Grouping nodes (`BoundedContext`, `Module`) and messages are _not_ blocks: groupings are package-backed, and messages get their own category because `SENDS`/`HANDLES` may only target them. Every `Behaviour` is owned by exactly one block.

**Invariants** (validated at ingest):

- A `Command` and a `Query` each have **exactly one** `HANDLES` behaviour, owned by an `ApplicationService`; an `Event` has **0..n** handlers.
- `INVOKES`, `SENDS`, `HANDLES` connect behaviours/messages only; every `Behaviour` has exactly one `CONTAINS` owner.
- One edge vocabulary for all three message kinds — the message node's type (not the edge name) distinguishes command/query/event rendering, so the edge set stays small.

**Derivation from the ArchUnit graph:**

| Element     | Derived from                                                                                                                        |
| ----------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| `Behaviour` | public, non-synthetic `JavaMethod`s of annotated blocks                                                                             |
| `INVOKES`   | `JavaMethodCall` between behaviours; calls routed through private helpers of the same block are collapsed onto the public behaviour |
| `SENDS`     | `JavaConstructorCall` of a message-typed class inside a behaviour (dispatcher-call patterns can be added later)                     |
| `HANDLES`   | behaviour on an `ApplicationService` with a message-typed parameter, or an explicit handler annotation                              |
| evidence    | `SourceCodeLocation` (class + line) of the underlying accesses                                                                      |

**Annotation mapping:** jMolecules covers most of the vocabulary — `jmolecules-ddd` for the tactical blocks, `@DomainEvent`/`@DomainEventHandler` (`jmolecules-events`), `@Command`/`@CommandHandler` (CQRS architecture module), and the hexagonal port/adapter set. A `Query` stereotype has no jMolecules annotation — provide it via the configurable mapping (team annotation or a small `noesis-annotations` artifact).

**Payload note:** behaviours multiply node count by roughly the average number of public methods per block (~5–10×) — still orders of magnitude below variant C's class-level graph; R5 unaffected.

## 10. Open questions (for decisions.md once resolved)

1. **Derivation details** — `SENDS` beyond constructor calls (dispatcher/bus invocation patterns); how ambiguous access targets (0..n resolution) affect `INVOKES`; whether non-public methods ever become behaviours (e.g. private event listeners).
2. **Multi-module builds** — one graph per module with cross-module linking server-side, or aggregate in the plugin (Maven aggregator mojo / Gradle root task)?
3. **Transport** — file artifact only (CI uploads it) vs. direct POST from the plugin (needs auth story)?
4. **Coordinates** — group ID (`vision.noesis`?), plugin IDs (`noesis-scanner-maven-plugin`, `vision.noesis.scanner` on the Portal), and repo layout (stay in monorepo outside the bun workspace, per README).

## Sources

- ArchUnit user guide & domain model: https://www.archunit.org/userguide/html/000_Index.html, https://github.com/TNG/ArchUnit (v1.4.2, 2026-04-18)
- `@PublicAPI` contract: https://github.com/TNG/ArchUnit/blob/main/archunit/src/main/java/com/tngtech/archunit/PublicAPI.java
- Spring Modulith on ArchUnit: https://spring.io/blog/2022/10/21/introducing-spring-modulith/
- archifacts: https://github.com/archifacts/archifacts
- jQAssistant manual: https://jqassistant.github.io/jqassistant/current/ · scanner SPI tutorial: https://101.jqassistant.org/implementation-of-a-scanner-plugin/index.html
- Spoon: https://github.com/INRIA/spoon · JavaParser: https://github.com/javaparser/javaparser · ASM: https://asm.ow2.io
- jMolecules (DDD + hexagonal annotations, ArchUnit integration): https://github.com/xmolecules/jmolecules · https://github.com/xmolecules/jmolecules-integrations
- CodeQL CLI license restrictions: https://github.com/github/codeql-cli-binaries/blob/main/LICENSE.md
- Dual-plugin architecture references: https://docs.openrewrite.org/reference/rewrite-maven-plugin, https://github.com/openrewrite/rewrite-gradle-plugin, https://github.com/spotbugs/spotbugs-gradle-plugin
