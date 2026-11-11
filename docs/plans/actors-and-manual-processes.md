# Plan: actors and manual processes instead of visibility

Status: built (November 2026). Approved the same month; decisions 2, 5
and 7 were settled in review: a manual process has a required `source`, `governs` is renamed
with `process_governs_rule` added, and the Java examples move to the
snapshot.

Today a behavior says who may call it: `ScannedBehavior.visibility` is
`private` or `public` with a list of actor names, and the design document
copies it (`DesignedBehavior.visibility`). Nearly every stored behavior is
`public` with `actors: []`; only the two fixtures name anyone ("Support
agent", "Quality manager"). This plan turns that around, as `noesis_es_view`
did in `f981bf36` ("name actors and manual processes, not visibility") and
the commits that followed it (`c8710d35`, `dc3f413f`, `19a54398`, `02238d35`,
`6dbd5118`). An actor and a manual process become elements of their own. An
actor performs a manual process, and a manual process invokes behaviors in
order. A behavior says nothing about who calls it.

Scope: the system model contract, the element ids, the builder and its
vocabularies, the Java annotation library (`@Actor`), the design document,
the SPA, and what must follow them for `bun run ci` to stay green: fixtures,
committed examples, generated contracts and the skills' tables.

Out of scope:

- The code model's `visibility` (`app/scanners/code-parsers/code-model.ts`).
  It is a fact of the code that the parsers write, and the builder still uses
  it to pick candidate members.
- The explorer's `visibility-panel.tsx`, which shows and hides elements and
  has nothing to do with behaviors.
- Deployable units, libraries, layers, deployment containers,
  `has_collaborator`, and the kinds `in_adapter`, `out_adapter`,
  `technical_service`.
- The C# annotation package, which already has `[Actor]`.

## 1. Decisions

1. **No visibility anywhere.** `Visibility` goes from the system model, and
   `DesignedBehavior.visibility` from the design document. No view, check or
   form reads it. Who calls a behavior is read from the relations that end
   at it. A behavior the builder makes from a non-public annotated method
   stays a behavior, with nothing on it to say so.
2. **Two new elements**, both extending `ScannedElement` as es_view does:
   - `ScannedActor`: a person or role outside the code who drives the
     system.
   - `ScannedManualProcess`: work an actor does by hand, which calls
     behaviors in order. Its `source` is required, as for every element,
     and names the file that encodes the process, such as the test that
     walks through it. No scan finds a process yet, so the requirement only
     binds a future one. A design document's `DesignedManualProcess`
     carries no `source`, like every other designed element.

   The `SystemModel` gains `actors` and `manualProcesses` after
   `scenarios`, each defaulting to `[]`.

3. **Ids with one segment**, as es_view spells them:
   - `actor|<name>`, e.g. `actor|Support agent`
   - `manual_process|<name>`, e.g. `manual_process|Refund a returned order`

   Neither belongs to a module. `element-id.ts` gains:
   - `actor` and `manual_process` in `ElementKind`
   - a `topLevelIdPattern`
   - `ActorId` and `ManualProcessId` with `of(name)` factories
   - `isActor` and `isManualProcess`
   - the two cases in the id matcher

4. **Two new relations**, named as es_view's final model names them:
   - `performs`: `ActorId` → `ManualProcessId`
   - `process_invokes_behavior`: `ManualProcessId` → `BehaviorId`, with
     `order` (the step's position in the process, counting from 1)

   `behavior_invokes_behavior` stays as it is.

5. **Rules kept by hand.** Add `process_governs_rule`
   (`ManualProcessId` → `RuleId`), and rename `governs` to
   `behavior_governs_rule` so that the two read as a pair. This matches
   es_view's current model. The rename touches 9 places in the code plus the
   stored rules.
6. **What the scan finds (R9.5 rewritten).** The `actor` roles found on:
   - the method,
   - the members it overrides or implements,
   - and the containing type

   each give one `actors` element per distinct name. Its `source` is where
   the name is first seen, with behaviors taken in id order. No relation
   joins the actor to the behavior. A name that is not an `ElementName` is
   dropped with a diagnostic. Manual processes are never scanned: a design
   document authors them. The `manualProcesses` list of a scanned model is
   empty.

7. **Java gets `@Actor`.** Port es_view's `Actor.java` into
   `code-parsers/java/annotations`. It is repeatable through an
   `Actor.Actors` container, and allowed on a `METHOD` or a `TYPE`.
   `java.vocabulary.ts` maps it to the `actor` role and reads through the
   container. `RoleArguments` gains `actor`: `value` in Java, `name` in C#,
   because Java's actor argument is not the block's `name`.

   The released `0.1.0` has no `@Actor`, so the Java examples move to
   `0.1.0-SNAPSHOT` from the local Maven repository, as es_view's
   `02238d35` did:
   - `examples/qdoc-java/pom.xml`: `noesis-annotations` and
     `noesis-parser-maven-plugin` at `0.1.0-SNAPSHOT`
   - `examples/discounts-java/app/build.gradle`: the
     `vision.noesis.parser` plugin and `noesis-annotations` at
     `0.1.0-SNAPSHOT`, with `mavenLocal()` before `mavenCentral()`
   - `examples/discounts-java/settings.gradle`: `mavenLocal()` in
     `pluginManagement`
   - both `.noesis/settings.json` files: an `installHint` that says to run
     `mvn install` in `code-parsers/java`, and for Gradle also
     `./gradlew publishToMavenLocal` in `code-parsers/java/gradle-plugin`

   Then `qdoc-java`'s `QDocCreationService.createQDoc` names "Quality
   manager" with `@Actor` in place of its Javadoc line, and
   `discounts-java`'s `DiscountCalculation.calculate` names the customer.
   Both models are rescanned with the real parsers. No CI job builds the
   examples, so the snapshot breaks nothing. The examples go back to a
   released version with the next `java-v*` tag.

8. **The design document mirrors the model**:
   - change sets `actors: changeSet(DesignedActor, ActorId)` and
     `manualProcesses: changeSet(DesignedManualProcess, ManualProcessId)`
   - the new relations in `DesignedRelation` and `DesignedRelationKey`
   - the integrity rule extended so that a `performs` or a
     `process_invokes_behavior` has both ends in the design or the model
9. **No migration code.** This follows decision 5 of `message-blocks.md`.
   One script in the pull request rewrites the committed models, the design
   documents and the fixtures (section 5). A stored model of the old shape
   elsewhere fails the strict schema and is replaced by the next scan.
10. **SPA** _(proposed; goes through the `design-system` skill's proposal
    step)_, as es_view built it:
    - actors appear after the modules in the model tree, with each manual
      process under every actor that performs it
    - the panels gain the sections Performs, Performed by, Steps and
      Invoked by
    - the explorer draws actors and processes as cards in no module, with a
      green Performs edge
    - the architecture view takes every behavior of an application service
      as a driving port, and reads its actors through the processes that
      invoke it

## 2. The contract

`server/backend/src/app/system-model/system-model.ts`:

- `Visibility` and `ScannedBehavior.visibility` go. The `.describe()` of
  `ScannedBehavior` and `ScannedRule` name `behavior_governs_rule` and
  `process_governs_rule`.
- `ScannedActor` and `ScannedManualProcess` are added after
  `ScannedScenario`, with es_view's descriptions.
- `PerformsRelation`, `ProcessInvokesBehaviorRelation` and
  `ProcessGovernsRuleRelation` are added.
  `GovernsRelation` is renamed `BehaviorGovernsRuleRelation`. The `Relation`
  union lists them in es_view's order.
- `ScannedManualProcess` extends `ScannedElement` unchanged, so its
  `source` is required (decision 2).
- `SystemModel` gains `actors` and `manualProcesses`.
- `server/backend/tools/contracts.ts`: no new lines, because the model ships
  as one contract.

## 3. The builder

`server/backend/src/app/scanners/system-model-builders/`:

- `vocabulary.ts`: the `actor` role's comment reads "names an actor
  element", and `RoleArguments` gains `actor`.
- `java.vocabulary.ts`: `[\`${ANNOTATIONS}.Actor\`, { role: 'actor' }]`,
  with `arguments.actor: 'value'`. The builder looks through
  `Actor.Actors`the way it looks through other repeatable containers
  (check how es_view's`dc3f413f` does it, and port that).
- `csharp.vocabulary.ts`: `arguments.actor: 'name'`.
- `build-system-model.ts`:
  - `toBehavior` loses `visibility`.
  - `actorsOf` becomes `collectActors`, which fills a
    `Map<ActorId, ScannedActor>`.
  - `build()` writes `actors` sorted by id, and `manualProcesses: []`.
  - R9.5 is rewritten as in decision 6.
- `docs/plans/code-model-to-system-model.md`: rewrite R9.5. In section 2's
  role table, the `actor` role makes an `actors` element. Add a short
  "was / is" table, as es_view's section 14 has.

## 4. The design document

`server/backend/src/app/design-docs/design-doc.ts`:

- `DesignedBehavior` loses `visibility`, and the `Visibility` import goes.
- `DesignedActor` and `DesignedManualProcess` (es_view lines 191–211), and
  their change sets after `scenarios`.
- `DesignedRelation` and `DesignedRelationKey` gain the new kinds. The
  `relations` `.describe()` names them.
- The integrity pass that checks a relation's ends knows the two new id
  kinds.
- `server/backend/tools/design-doc.example.json`: the "Support agent" behavior
  loses `visibility`. In its place the example gains an actor, a manual
  process, a `performs` and a `process_invokes_behavior` (es_view's
  example).

## 5. Stored files

One script, kept in the scratchpad and not committed, rewrites:

- every behavior: drop `visibility` (system models), or its `{ value }`
  field (designed behaviors); a designed behavior left empty by this is
  dropped from `modified`
- each named actor in a design document:
  - add an `actors` element
  - add a manual process named after the behavior it called
  - add `performs` and `process_invokes_behavior` (`order: 1`)
- every `governs` relation becomes `behavior_governs_rule`

Every stored actor list except the two fixtures is empty, so no other actor
or process is made. The files:

- `examples/discounts-dotnet/.noesis/graph/system-models/2026-10-21_16-48_uncommitted.json`
- `examples/discounts-java/.noesis/graph/system-models/2026-10-22_18-01_uncommitted.json`
- `examples/qdoc-java/.noesis/graph/system-models/2026-10-22_18-36_uncommitted.json`
- the five `examples/*/.noesis/graph/changes/**/*.design-doc.json`
- `server/frontend/test/fixtures/discounts-java.system-model.json`,
  `qdoc-create-a-qdoc.design-doc.json` ("Quality manager")
- `server/backend/tools/design-doc.example.json` ("Support agent")

The older qdoc-java models (`2026-10-01…`, `2026-10-02…`, `2026-10-22_16-56…`)
have no visibility, so they stay as they are.

## 6. Frontend

Every `Visibility` import breaks at compile time, which lists the work. Port
es_view's `f981bf36`, file for file. Under `server/frontend/src/`:

- `features/system-model/system-model.model.ts` (`designOf`): the two new
  lists.
- `features/design-docs/element-id.ts`: actor and manual-process ids.
- `features/design-docs/people.ts` (new): actors, the processes each
  performs, a process's steps, and who invokes a behavior.
- `features/design-docs/design-doc-outline.ts`,
  `ui/model-tree/model-outline.ts`, `ui/model-tree/kind-icon.tsx`: actors
  after the modules, processes under their actors, icons for both.
- `ui/model-tree/outline-scope.ts`: "public" is no longer read from
  visibility. Port es_view's version.
- `ui/element-details/element-detail.tsx`, `element-ref.ts`,
  `change-list-items.ts`, `body/body-sections.tsx`,
  `body/sections/change-list-section.tsx`, `body/people-sections.tsx` (new):
  the people sections. `visibility-badge.tsx` is deleted.
- `ui/unit-editor/unit-fields.tsx`, `unit-editor-modal.tsx`,
  `design-doc-edit.ts`: the visibility field and `VisibilityInput` go, and
  forms for an actor and a manual process come in.
  `shared/design-system/tags-input.tsx` and its design-sync preview go if
  nothing else uses `TagsInput`.
- `design-doc-architecture.ts`, `architecture-outline.ts`,
  `ui/architecture/architecture-details.tsx`, `layout-architecture.ts`:
  - every behavior of an application service is a driving port, and its
    actors come through `performs` and `process_invokes_behavior`
  - the `exposed` band takes every behavior of any other typed block
- `architecture-checks.ts`: "Every public behavior names the actors that
  call it" becomes "Every driving port is invoked by a manual process".
- `shell/search/search-entries.ts`: actors and processes can be searched.
- The explorer, ported from es_view's `c8710d35`:
  - `system-model-exploration.ts`
  - `ui/exploration/element-node.tsx`, `exploration-view.tsx`,
    `relation-colors.ts`, `themes/themes.ts` and
    `themes/cyberarch/cyberarch.module.css`
  - `ui/element-search.tsx` and `ui/architecture/element-body.tsx`
  - the Performs color in `shared/design-system/theme.ts`, which means
    `/design-sync` is owed

Checks after building:

- the model tree, the panels, the explorer and the architecture view on the
  qdoc fixture and `examples/qdoc-java`, in both themes
- screenshots for the pull request

## 7. Skills

- `create-design-doc` (`SKILL.md`, `references/modelling.md`) and
  `update-design-doc`: actors and manual processes as elements. When to
  author a process. No visibility on a behavior.
- `implement-java-spring` (`references/mapping.md`,
  `references/building-blocks.md`): write `@Actor` on a use case, not an
  "Actors:" line in its Javadoc.
- `setup-java-scanner`: list `@Actor`. `setup-dotnet-scanner`: say what
  `[Actor]` now makes.

## 8. Tests

Backend (`server/backend/test/`):

- `unit/element-id.spec.ts`: both new ids, their factories and how they are
  refused.
- `unit/system-model.spec.ts`:
  - a behavior with `visibility` is refused
  - an actor, a manual process, `performs`, `process_invokes_behavior`,
    `behavior_governs_rule` and `process_governs_rule` are accepted
  - a manual process without `source` is refused, and so is a `governs`
  - a relation whose ends are the wrong kinds is refused
- `unit/system-model-builder.spec.ts`:
  - actors from a method, an overridden member and a type, deduplicated,
    with the source where each was first named
  - a name that is not an `ElementName` is dropped
  - Java's repeated `@Actor` is read through `Actor.Actors`
- `unit/csharp-parser.spec.ts`, `unit/java-parser.spec.ts`: no visibility,
  and actors where the fixtures name them. For Java, add two `@Actor`
  annotations to the shop fixture's `PlaceOrderHandler.handle` and
  regenerate its code model (es_view `19a54398`). Then
  `e2e-toolchain/java-parser.e2e.spec.ts` asserts the actors.
- `unit/design-doc.spec.ts`, `fixtures/design-doc.fixture.ts`:
  - change sets for both elements
  - the relation-end rule for the new kinds
  - a designed behavior carrying `visibility` is refused
- `contracts-json-schema.spec.ts`: the example still validates.

Frontend (`server/frontend/test/`):

- `people.spec.tsx` (new)
- `design-doc-architecture.spec.ts` (ports read through processes, the new
  check text)
- `architecture-view.spec.tsx`
- `outline-scope.spec.ts`
- `design-doc-edit.spec.ts`
- `search-entries.spec.ts`
- `system-model-exploration.spec.tsx` (actor and process cards, Performs
  edges)

## 9. Steps

Each step leaves `bun run ci` green.

1. **`feat(system-model)!: name actors and manual processes, not visibility`**:
   sections 2, 3 (without Java's row), 4 and 6 except the explorer, with
   7's design-doc skills and 8's tests. The contract, the design document
   and the SPA change together because the SPA type-checks against the
   contract.
2. **`chore(examples): move the example models to actors and manual processes`**:
   section 5's script.
3. **`feat(frontend): draw actors and manual processes in the explorer`**.
4. **`feat(scanner): read Java's @Actor`**: the annotation, the vocabulary
   row, the shop fixture, and the Java skills.
5. **`chore(examples): name actors with @Actor in the Java examples`**:
   the snapshot switch, the two annotations and the rescanned models
   (decision 7).
6. **`chore(docs)`**: `code-model-to-system-model.md` R9.5 and this plan's
   status.

Decision 5 (`process_governs_rule` and the rename) goes in step 1, and its
conversion in step 2's script.
