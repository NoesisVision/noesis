# Plan: rules and scenarios from feature files

Status: built (November 2026) on `feat/system-model-rules-from-features`.

Update: the scan no longer reads feature files. The system model is a
projection of the code model alone, so the reading and binding below
(`SourceRepository.featureFiles`, `app/scanners/feature-files/`, the
`stepDefinition` role) were taken out; they move to the parsers later.
The model keeps its `rules` and `scenarios`, empty after a scan.
Beyond the plan, decided while building:

- `main`'s writer's rule `uncontained` stays, for modules, blocks and
  behaviors; an added scenario needs no containment, only the
  `illustrates` the id check asks for, as on the branch.
- The C# parser fixture keeps its `[Scenario]` attributes (parsers are out
  of scope); the vocabulary no longer reads them, so the C# parser spec
  expects no scenarios.
- The design document fixtures drop the module's quality rule, as the
  branch did: a rule is on a behavior or nowhere.
- The example design documents were converted by a scratchpad script that
  took each rule's kind, governing behavior and id, and each scenario's
  rule, from the branch's copies of the same documents. Two placements are
  dubious and kept as the branch has them: `ThresholdDiscount`'s "applies
  above the threshold" scenarios illustrate the input-validity rule, and
  "Open-Meteo response is mapped to a weather snapshot" the
  provider-failure rule. The weather design's `governs` from
  `DiscountPolicyFactory.get`, a behavior the scan lacks, adds an
  `unknownRelationEnd` beside the `unknownElement` the design already had.

Port step 2 of `docs/plans/new-system-model.md` (on branch
`feat/system-model-relations`, PR #106, at `f822a2d4`; the file is not on
`main`) onto `main` (at `6866e041`, after PR #108), limited to the system
model, the UI and the design skills that write design documents. After the
port, rules and scenarios behave on `main` as they do on that branch in the
contract, the ids, the scan's projection, the design document, the SPA and
the design skills. The parsers do not change.

## 1. What changes, in one paragraph

A rule and a scenario stop being values nested in modules, blocks and
behaviors and become elements with ids, in two top-level lists `rules` and
`scenarios`. A behavior follows a rule through a `governs` relation; a
scenario is an example of a rule through an `illustrates` relation. A rule
has one classification, `kind` (`validation`, `state_change`, `post`,
`computation`, `coordination`, `configuration`); `category`, `ruleType` and
`RULE_TYPES_OF` go. The scan no longer reads rules and scenarios from
annotations (the C# `[Scenario]` mapping goes): it reads them from the
repository's Gherkin feature files, a `Rule:` being a rule, its kind a tag,
a `Scenario:` under it a scenario, and the behavior that the scenario's
`When` steps reach through their step definitions (`@When` in Cucumber,
`[When]` in Reqnroll) governing the rule.

## 2. Scope

In scope, as on the branch:

- Decisions 8, 9 and the rule and scenario half of decision 16 of
  `new-system-model.md`, with the "beyond the plan" notes of its step 2
  (section 11).
- The step expression fix (`46eb092f`): an expression is read as the
  language's step library reads it.
- The SPA fix that marks nothing as added in a scanned model (`7be93e69`),
  which the rule tree needs.
- The old given/when/then upgrade of stored scenarios deleted (part of
  `b97d6080`, decision 17).
- The rule and scenario parts of the documents of step 9 (`8bc16bfc`) that
  describe the system model.
- The rule and scenario guidance of the design skills, `create-design-doc`
  and `update-design-doc` (section 4.8), so that an agent following them
  writes a design document the new contract accepts.

Out of scope:

- **Parsers.** No change under `code-parsers/`: the Java parser keeps
  parsing main sources only (`b97d6080`'s test-source parsing and
  `noesis.includeTests` are not ported), and the `CSharpSyntax` fixture and
  its golden model stay as they are. Consequences in section 6.
- **Other skills and examples' code.** `implement-java-spring`,
  `setup-java-scanner`, `setup-dotnet-scanner` and `AGENT.md` are not
  edited; `qdoc-java` gets no feature files or step definitions
  (`18aa4d07`, `c8d94ad8`, `5be0ef6b` not ported).
- **Other steps of PR #106**: the fourteen building block kinds and
  `has_collaborator` (step 3); actors, manual processes, removing
  `Visibility` and `BehaviorType` (step 4); deployable units, libraries,
  library manifests, layers, deployment containers (steps 5, 6); the new
  annotations (step 7). On `main` a behavior keeps `type` and `visibility`;
  only its `rules` and `scenarios` go.

## 3. Approach: port the end state, not the commits

Cherry-picking `e9f5a864` and its followers onto `main` does not work well:
they sit on top of step 1 as PR #106 first built it (`contains`, `invokes`)
and on step 3, while `main` rebuilt step 1 its own way in PR #108
(`module_contains_block`, `behavior_invokes_behavior`, cardinality `*`,
start and end lines). Nearly every shared file would conflict.

The branch's last commits (`b394cbfa` to `f822a2d4`) moved it to `main`'s
naming, so its HEAD speaks `main`'s vocabulary. The port therefore takes
the branch HEAD as the reference for every rule and scenario behavior:

- Files that are new on the branch and only about rules and scenarios are
  copied whole (section 4 marks them **copy**).
- Shared files are merged by hand: only the rule and scenario hunks of the
  branch HEAD are taken, leaving out anything about kinds, actors,
  collaborators, units, libraries and layers (marked **merge**).
- `e9f5a864`, `7be93e69` and `46eb092f` are the guide for what a change
  touches; `git -C ../noesis_es_view show <commit>` shows the intent of a
  hunk. Their hunks under `code-parsers/` are skipped, and under
  `plugins/claude-code/skills/` only the design skills' are taken.

## 4. Changes by area

### 4.1 Contract — `server/backend/src/app/system-model/system-model.ts` (merge)

- Delete `RuleCategory`, `BusinessRuleType`, `QualityRuleType`,
  `ConstraintRuleType`, `RuleType`, `RULE_TYPES_OF` and the nested
  `ScannedRule` and `ScannedScenario` objects.
- Add `RuleKind` and the two elements, as on the branch:
  `ScannedRule = ScannedElement & { id: RuleId, kind: RuleKind }`,
  `ScannedScenario = ScannedElement & { id: ScenarioId, steps: ScenarioSteps }`
  (at least one step).
- Remove `rules` from `ScannedDomainModule`, and `rules` and `scenarios`
  from `ScannedBuildingBlock` and `ScannedBehavior`. Keep `BehaviorType`
  and `Visibility`.
- Add `GovernsRelation` (`governs`, behavior to rule) and
  `IllustratesRelation` (`illustrates`, scenario to rule) to `Relation`.
- Add `rules` and `scenarios` lists to `SystemModel`.
- `relation-order.ts`: the two new kinds sort like the others.
- Regenerate the generated JSON Schemas (`server/backend/tools/contracts.ts`
  writes `plugins/claude-code/contracts/`): they are the contract's output,
  not a skill, and the schema test checks them.

### 4.2 Ids — `server/backend/src/app/element-id.ts` (merge)

`RuleId` (`rule|<module path>.<name>`, `RuleId.within(module, name)`) and
`ScenarioId` (`scenario|<rule path>.<name>`, `ScenarioId.within(rule, name)`).
`ElementId` becomes a union of five, `ElementId.match` takes five handlers,
`isRule` and `isScenario` join the guards. A rule belongs to the module of
the behavior that governs it (the first scenario's, when several do). The
frontend's `features/design-docs/element-id.ts` follows (`kindOf`,
`moduleOf`, `parentOf`).

### 4.3 Scan input — feature files

- `server/backend/package.json`: `@cucumber/gherkin`,
  `@cucumber/cucumber-expressions`, `@cucumber/messages` at the versions
  the branch uses; `bun.lock`.
- `app/scanners/source-repository.ts` (merge): `featureFiles()`, every
  tracked `*.feature` file by its path from the root.
- `adapters/out/scanners/git-source-repository.ts` (merge): lists them with
  Git and reads them.
- `app/scanners/scanner.ts`, `system-model-builder.ts` (merge): the scanner
  reads the feature files beside running the code parser and hands both to
  the builder. The code parser is called as today.
- `app/scanners/scan-log.ts`, `adapters/out/scanners/server-scan-log.ts`
  (merge): the feature-file diagnostics.
- `app/scanners/feature-files/feature-file.ts`, `step-expression.ts`
  (**copy**, HEAD versions, which already have the `46eb092f` fix and the
  start and end lines).

### 4.4 Builder — `app/scanners/system-model-builders/` (merge)

The builder reads the code model the parsers already write; only how it
projects that model changes.

- `vocabulary.ts`: the `stepDefinition` role, with its expression
  argument; the `scenario` role goes. Each vocabulary says how its step
  library reads an expression (`46eb092f`).
- `java.vocabulary.ts`: `io.cucumber.java.en.When`, and its repeatable
  container `When.Whens`. `csharp.vocabulary.ts`: `Reqnroll.WhenAttribute`
  (not SpecFlow's); the `ScenarioAttribute` row goes.
- `annotations.ts`: read a repeated annotation through its container.
- `build-system-model.ts`: R12 as on the branch HEAD (the methods from
  "R12: every rule of every feature file" to `stepDefinitions()`): rules,
  scenarios, `governs`, `illustrates` and every diagnostic of decision 9.
  `scenariosOf` and the empty rule lists of R4.7 and R9.9 go.
- Beyond decision 9, as built on the branch: an outline's `When` steps are
  matched with its first example filled in, its steps kept as written;
  every `When`-kind step counts, wherever it stands; a rule none of whose
  scenarios binds is dropped.

### 4.5 Design document — `app/design-docs/` (merge)

- `design-doc.ts`: `DesignedRule = { id: RuleId, name, description, kind,
  needs, rationale }` and `DesignedScenario = { id: ScenarioId, name,
  description, steps }`, each a top-level change set keyed by id; the nested
  `rules` and `scenarios` of modules, blocks and behaviors go. The
  `relations` change set and `relation-key.ts` gain `governs` and
  `illustrates`.
- Writer's rules (`invalid-design-doc-error.ts`): `ruleTypeOutsideCategory`
  and `businessRuleOnModule` go; `ungovernedRule` (an added rule needs an
  added `governs`) and "an `illustrates` agrees with the ids" come.
- `stored-design-doc.ts`: the given/when/then upgrade goes, with its spec.
- `server/backend/tools/design-doc.example.json`, the MCP
  `tool-handler.ts` text, `adapters/out/store/design-docs.repository.ts`.

### 4.6 SPA — `server/frontend/src/` (merge, `features/design-docs/rules.ts` copy)

The behavior the user approved on the branch (design-system proposal,
2026-11-03), kept as is:

- A rule shows in the model tree under each behavior that governs it, or
  under the module its id names when the design names no governor; its
  scenarios under it.
- A rule's panel has Kind, Governed by and Needs rows; the forms have one
  Kind select; "New rule" is offered on behaviors only.
- The requirements view, the outline and the overview read rules through
  `governs`; a rule's phrase is its kind.
- Nothing is marked added in a scanned model (`7be93e69`:
  `change-marks-context.ts`, `change-badge.tsx`, `model-reader.tsx`,
  `exploration-view.tsx`).

Files, from the branch's `e9f5a864` and `7be93e69`:
`features/system-model/system-model.model.ts` (`designOf`),
`features/design-docs/` (`relations.ts` gains `governs` and
`illustrates`, `design-doc-edit.ts`, `design-doc-outline.ts`,
`design-doc-requirements.ts`, `design-doc-description.ts`,
`design-doc-architecture.ts`, `architecture-outline.ts`, `change-set.ts`,
`element-reader.ts`), the element details (`rule-sections.tsx`,
`scenario-*.tsx`, `scenarios-of.ts`, `rule-cards.tsx`,
`rule-trace-section.tsx`, `module-sections.tsx`,
`building-block-sections.tsx`, `behavior-sections.tsx`,
`part-sections.tsx`, `change-list-*.ts(x)`), the requirements view
(`rule-entry.tsx`, `requirements-document.tsx`), the unit editor
(`unit-fields.tsx`, `unit-editor-modal.tsx`, `new-buttons.tsx`,
`remove-button.tsx`, `scenario-actions.tsx`), `shell/search/search-entries.ts`.

The design was approved on the branch, so the `design-system` proposal step
shows that approved design again for a yes rather than starting a new one.
No `theme.ts` change is expected; if one comes, `/design-sync` is owed.

### 4.7 Fixtures and stored data

- Backend `test/fixtures/design-doc.fixture.ts` and the frontend fixtures
  (`server/frontend/test/fixtures/`: the outline, requirements, qdoc design
  document and discounts-java system model fixtures): the new shape.
- Example design documents (`discounts-dotnet` threshold design: 7 rules,
  `discounts-java` weather design: 7, `qdoc-java` create-a-qdoc: 21) and
  committed system models: converted by a scratchpad script, not kept, as
  the branch did. Rules move to the top-level change set with ids under the
  governing behavior's module, `governs` and `illustrates` added, scenarios
  given ids. The `category`/`ruleType` to `kind` mapping is taken from the
  branch's converted copies of these same documents (same rule names), not
  invented. The committed system models carry no rules after conversion:
  no example has feature files.
- The Java shop fixture (`server/backend/test/fixtures/java/shop`) and its
  code model are not touched: binding its scenarios needs the parser to
  read test sources.

### 4.8 Design skills — `plugins/claude-code/skills/` (merge)

The rule and scenario guidance of the branch HEAD versions (from
`e9f5a864` and `8bc16bfc`), leaving out what they say about actors, manual
processes, the new building block kinds, collaborators, units, libraries,
layers and containers, and anything that assumes a behavior has no `type`
or `visibility`:

- `create-design-doc/SKILL.md`: rules and scenarios as top-level change
  sets keyed by id (`rule|<module path>.<name>`,
  `scenario|<rule path>.<name>`), linked by `governs` and `illustrates` in
  the `relations` change set; an added rule needs an added `governs`.
- `create-design-doc/references/modelling.md`: rules on behaviors only,
  a `kind` instead of a category and a rule type, with what each kind
  means; a scenario's steps written as the Gherkin steps they become; a
  distinct `When` wording per behavior, since one wording binds to one step
  definition.
- `create-design-doc/references/description.md`: how a rule and its
  scenarios are described, by kind.
- `update-design-doc/SKILL.md`: the same shape when a design is changed;
  rules and scenarios edited by id.

The plugin's JSON Schemas (section 4.1) are what the skills point agents
to; their wording and the schemas must agree.

### 4.9 Documents

- `docs/plans/code-model-to-system-model.md`: R12, the R4.7 and R9.9
  rows marked superseded, the part of section 14 about rules and scenarios.
- `docs/arch/ARCHITECTURE.md`: the scanner paragraph (a second input
  beside the code model).
- This plan, marked built when done.

### 4.10 Tests

- Backend: `feature-files.spec.ts` and `test/support/feature-files.ts`
  (copy, then adjust), `system-model.spec.ts`, `element-id.spec.ts`,
  `system-model-builder.spec.ts` (R12 `describe`s over hand-built code
  models, which need no parser), `scanner.spec.ts`,
  `scan-system-model.spec.ts`, `design-doc.spec.ts`,
  `stored-design-doc.spec.ts`. `csharp-parser.spec.ts`,
  `java-parser.spec.ts` and the toolchain e2e specs change only where
  their expected models carry the old nested rules and scenarios; they gain
  no rule cases, as the parser fixtures have no feature files.
- Frontend: `element-detail`, `design-doc-edit`, `design-doc-outline`,
  `design-doc-requirements`, `design-doc-description`, `requirements-view`,
  `rule-trace`, `scenario-steps`, `scenario-focus`, `search-entries`,
  `system-model`, `system-model-exploration`, `unit-editor`,
  `architecture-view`.
- Green on `bun run ci`, and on `bun run test:e2e:toolchain` since the
  examples' stored models change shape.

## 5. Steps

One pull request: contract, ids, feature-file reader, builder, design
document, SPA, fixtures, converted examples, design skills and documents
together, so no state leaves two shapes alive. Suggested commit order
inside it: contract and ids; feature-file reader and builder; design
document; SPA; fixtures and examples; documents. The design skills
(section 4.8) are a commit of their own, touching nothing outside
`plugins/claude-code/skills/create-design-doc/` and
`plugins/claude-code/skills/update-design-doc/`.

## 6. What leaving the parsers alone means

- **C#** works end to end: the .NET parser already parses test projects, so
  a Reqnroll `[When]` step definition is in the code model and a scan binds
  feature files to behaviors.
- **Java** does not bind yet: the Java parser parses main sources only, so
  a Cucumber `@When` in `src/test/java` is not in the code model. Every
  feature-file rule of a Java repository is dropped with a diagnostic (no
  `When` step matches a step definition). Step definitions placed in main
  sources would bind. Porting `b97d6080` later makes Java work with no
  further change to the system model or the UI.
- No end-to-end test reads a feature file through a real parser; the
  binding is covered by the builder's unit tests.

## 7. Decisions the port takes

1. Behavior `type` and `visibility` stay on `main`; only the nested rules
   and scenarios leave the behavior. Rule code copied from the branch that
   reads neither is unaffected; code that assumes their absence is adapted.
2. The `category`/`ruleType` to `kind` mapping of the example documents
   follows the branch's conversion of the same documents.
3. No migration code (decision 17 of `new-system-model.md`): a stored model
   or design document of the old shape is not read or upgraded.

## 8. Open questions

1. **Java test sources.** Port `b97d6080` (and a `java-v*` release, which
   publishes to Maven Central) as a separate pull request later?
2. **PR #106.** Once this lands, PR #106's step 2 is on `main`. Rebase
   PR #106 onto `main` to drop it, or close PR #106 and port its other
   steps the same way?
3. **Feature files outside Git.** As on the branch, only tracked files are
   read; a generated or ignored feature file is not.
