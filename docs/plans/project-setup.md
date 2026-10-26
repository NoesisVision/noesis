C# Plan: setting up Noesis in a project

Today a new project needs a person to: add the marketplace and install the
plugin by hand (`/plugin marketplace add …`, `/plugin install noesis`), write
`.noesis/settings.json` from one of the examples, and build and install the
parser from a clone of this repository (`dotnet pack` + `dotnet tool install`
for C#; `mvn install` and `./gradlew publishToMavenLocal` for Java, plus
editing the build to declare the parser plugin and `mavenLocal()`). A missing
piece shows up only as the error of the first scan.

This plan makes setup one command plus a few questions. Everything that can be
decided from the repository or from a fixed rule is done by code, in one
place, the service's `init`. People are asked only what code cannot know.
Initialisation never changes the user's existing code.

## Decisions

| Topic                | Decision                                                                                                                                                                                                         |
| -------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Entry point          | `bunx @noesis-vision/noesis init`, run once per project from its root. No flags: every option is a question `init` asks, with the detected answer as the default                                                 |
| Where the logic is   | In the service (`server/backend`), reused by the CLI, an MCP tool and the plugin's setup skill. The skill holds no setup rules of its own                                                                        |
| Plugin scope         | Per project: `init` adds `extraKnownMarketplaces` and `enabledPlugins` to the project's `.claude/settings.json`, which is committed, so every teammate's Claude Code offers the plugin                           |
| User code            | Never changed by `init`. It writes only `.noesis/` and merges keys into `.claude/settings.json`. Anything that would touch the build or sources (annotations dependency) is printed as a next step, not applied  |
| Empty repository     | Supported. Nothing to detect, so `init` asks the language, the build tool (Java) and the namespace prefix, and writes the settings for the build the project will have                                           |
| C# parser            | Stays as implemented: the global dotnet tool `noesis-parse-csharp` on the PATH, no command in settings. `init` installs it (`dotnet tool install -g Noesis.Parser`) when it is missing and the .NET SDK is there |
| Java parser          | Runs without a build change: the Maven plugin by its full coordinates, the Gradle plugin through an init script Noesis owns under `.noesis/`                                                                     |
| Package repositories | The standard ones: npm (service, plugin), nuget.org (`Noesis.Parser`, `NoesisVision.Annotations`), Maven Central (`vision.noesis` annotations and parser), Gradle Plugin Portal (`vision.noesis.parser`)         |
| Versions             | One version train. Every parser and annotations artifact is released with the plugin's version, and every pin `init` writes is stamped from it                                                                   |

## Where it stands

- `NoesisDir.ensureInitialized` (`platform/files/noesis-dir.ts`) already
  creates `.noesis/` and its unversioned directories and their `.gitignore`
  when the service boots. `init` reuses it.
- `ScannerSettingsFileRepository` (`adapters/out/store/scanner-settings.repository.ts`)
  validates `.noesis/settings.json` with a strict zod schema. `init` and
  `doctor` validate with the same schema.
- The `noesis` bin (`server/backend/package.json`) starts the MCP service and
  takes no subcommands.
- `.mcp.json` launches `bunx @noesis-vision/noesis@<pin>`, but
  `@noesis-vision/noesis` is not found on npm (404 on 2026-10-24), so the
  published plugin `0.1.0-beta.4` cannot start its service.
- The `noesis` (stable) marketplace channel pins `0.1.0`, which is not
  published; npm's `latest` dist-tag is `0.1.0-beta.1`. The README's
  `/plugin install noesis` installs the stable channel.
- `Noesis.Parser` is not on nuget.org. Nothing under `vision.noesis` is on
  Maven Central. The Gradle plugin is only in `mavenLocal()`.
  `NoesisVision.Annotations` is on nuget.org (0.1.0–0.1.3).
- Running the Gradle plugin on a build that does not apply it (an init
  script) is deferred in `code-model-java-parser.md` §7.

## Step 0: a release that installs

1. Publish `@noesis-vision/noesis` publicly and check that
   `bunx @noesis-vision/noesis@<pin>` starts. Find why the `Publish service`
   step of `release.yml` left no package.
2. Until a stable release exists, drop the `noesis` channel from
   `marketplace.json` or point the README at `noesis-beta`. Set npm's `latest`
   dist-tag to match the stable channel once there is one.
3. Move the marketplace `owner` to the organisation.
4. Add a release smoke test: in a temporary project, start the published
   service over stdio and call `list_changes`.

## Step 1: publish the parsers

Every artifact is published by `release.yml` from the same `v*` tag, before
the plugin, so a pin `init` writes always resolves.

- **C#**: `dotnet pack` `Noesis.Parser.Cli` with the train's version and push
  `Noesis.Parser` to nuget.org. The service keeps calling
  `noesis-parse-csharp` from the PATH.
- **Java, Maven**: publish `annotations`, `model`, `core` and
  `noesis-parser-maven-plugin` to Maven Central under `vision.noesis` (the
  namespace needs verifying for the domain). A build runs the plugin without
  declaring it:

  ```
  ./mvnw -B -q -ntp -Dnoesis.out={out} -Dnoesis.repository={name} \
    -Dmaven.compiler.failOnError=false \
    process-classes vision.noesis:noesis-parser-maven-plugin:<v>:parse
  ```

- **Java, Gradle**: publish `vision.noesis.parser` to the Gradle Plugin
  Portal. Implement the deferred init script: it applies the plugin to the
  root project of a build that does not declare it. `init` writes it to
  `.noesis/gradle/noesis.init.gradle`, and the command runs
  `./gradlew -q --init-script .noesis/gradle/noesis.init.gradle noesisParse …`.
- The `installHint` of each template names the real cause (no JDK, no
  wrapper), not a local build of this repository.

## Step 2: `noesis init` and `noesis doctor`

Both are subcommands of the service's bin, so `bunx @noesis-vision/noesis`
runs them with nothing installed but bun.

### Detection (no questions)

| Found at the root                             | Language | Build tool |
| --------------------------------------------- | -------- | ---------- |
| `*.sln`, `*.slnx`, `*.csproj`                 | `csharp` | —          |
| `pom.xml`, `mvnw`                             | `java`   | Maven      |
| `build.gradle`, `build.gradle.kts`, `gradlew` | `java`   | Gradle     |
| nothing of the above                          | asked    | asked      |

- Java engine: `hybrid` when the build names Lombok or another annotation
  processor, else `source`.
- Toolchain: bun, the .NET SDK (10 or newer) for C#, a JDK (17 or newer) and
  the wrapper for Java, whether `noesis-parse-csharp` is on the PATH and at
  which version.

### Questions

`init` asks in the terminal, each with the detected value as the default.
Only what applies is asked.

1. Language, when nothing was detected or more than one was.
2. Build tool (Java), when not detected.
3. Engine (Java), when the default could be wrong (annotation processors
   found but not Lombok).
4. `namespacePartsToSkip`: the default is the longest namespace prefix
   common to the code, from a first parse; in an empty repository it is
   asked outright (for example the company prefix).
5. `namespacesToExclude`: candidates found in the first parse (`*.Tests.*`,
   `*.TechnicalStuff.*`, test source sets), each to accept or drop.
6. Install `Noesis.Parser` now (C#, when missing or older than the train).
7. Whether a `.noesis/settings.json` that already exists is replaced; the
   difference is shown first. The default keeps it.

### What it writes

- `.noesis/` through `NoesisDir.ensureInitialized`.
- `.noesis/settings.json` from the template for the language and build tool,
  with the answers and the pinned versions, validated against
  `RepositorySettingsSchema` before writing.
- `.noesis/gradle/noesis.init.gradle` for a Gradle project.
- `.claude/settings.json`, merged key by key and never overwritten:
  `extraKnownMarketplaces.noesis` (the marketplace URL),
  `enabledPlugins["noesis@noesis"] = true` and an `allow` entry for the
  Noesis MCP tools. Keys already there are kept.

### What it runs

- `dotnet tool install -g Noesis.Parser --version <v>` (or `update`) when
  the person said yes to question 6. If the .NET SDK is missing it says what
  to install and goes on.
- `claude plugin marketplace add` and `claude plugin install noesis@noesis
  --scope project` when the `claude` CLI is on the PATH, so the person who
  ran `init` has the plugin at once. Teammates get it from the committed
  settings.
- A first parse to answer questions 4 and 5, skipped in an empty repository.
- `doctor` at the end.

### What it prints

- Each file written or merged.
- The next steps it does not take itself, because they change the user's
  code: the annotations dependency (`dotnet add package
  NoesisVision.Annotations`, or the Maven or Gradle snippet), and committing
  `.noesis/` and `.claude/settings.json`.
- Start Claude Code in the project and run `/noesis:setup` or scan.

### `noesis doctor`

Read-only. Checks the toolchain, that `.noesis/settings.json` exists and is
valid, that the parser command resolves (the dotnet tool and its version; the
wrapper and the JDK), and that the plugin is enabled in
`.claude/settings.json`. Prints one line per check, each failure with its fix,
and exits non-zero when any fails.

### Shape in the code

- `app/setup/`: detection, the settings templates and the rules that turn
  detected facts and answers into the files to write. Pure, so it is tested
  without a terminal.
- `adapters/in/cli/`: the `init` and `doctor` commands, terminal prompts.
- `adapters/in/mcp/`: the tools in step 3, over the same `app/setup/` code.
- `main.ts` dispatches on its first argument; no argument keeps today's MCP
  service.

### Tests

- Detection and templates on fixtures: one per language and build tool, an
  empty repository, a repository with two languages.
- `init` on copies of `discounts-dotnet`, `discounts-java` and `qdoc-java`
  with scripted answers must produce their committed `.noesis/settings.json`
  (once those use the published coordinates).
- Merging `.claude/settings.json` keeps every key that was there.
- No file outside `.noesis/` and `.claude/settings.json` changes (a git
  status check after `init` on each fixture).

## Step 3: the plugin

- **MCP tools**: `check_setup` returns the `doctor` checks as structured
  issues; `set_up_project` takes the answers to the questions as arguments
  and writes what `init` writes. These are how the skill reaches the
  `app/setup/` code; they are not something a person types.
- **Skill `setup`** (`/noesis:setup`): calls `check_setup`, asks the
  questions the result leaves open, using the detected defaults, calls
  `set_up_project`, then `scan_system_model`, and reports the modules
  found. It asks before installing `Noesis.Parser`.
- **SessionStart hook**: when `.noesis/settings.json` is missing, prints one
  line suggesting `/noesis:setup`. A file check only, nothing started.
- **Bootstrap**: a plugin cannot install itself, so the first person runs
  `bunx @noesis-vision/noesis init` from a shell. Everyone after them is
  offered the plugin by Claude Code from the committed settings, and can
  finish anything left with `/noesis:setup`.

## Step 4: docs

- `docs/getting-started.md`: prerequisites (bun; the .NET SDK or a JDK),
  `bunx @noesis-vision/noesis init`, the questions it asks, what it writes,
  `/noesis:setup`, the first scan, the annotations to add by hand, and every
  field of `.noesis/settings.json`.
- The plugin README links to it instead of the manual install steps, and
  drops the duplicated sentence in "What's inside" ("…A skill and compares
  what they saved…").
- `examples/README.md`: `discounts-dotnet` restores from nuget.org only (its
  `nuget.config`), not a private feed.
- `code-parsers/dotnet/README.md` and `code-parsers/java/README.md`: install
  from the published packages first; building locally stays as the way to
  work on the parsers.

## Open

- Monorepos with more than one solution or build at the root: one
  `.noesis/` per repository with several parsers, or one per subproject.
  Today the settings hold one parser, so `init` asks which one.
- Whether a person may skip the first parse in a large repository (it runs
  the build) and type the namespace prefix instead.
