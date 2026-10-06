# Plan: needs and rule categories in the design document

A design document today holds what a change does to the domain model
(modules, building blocks, behaviours) and the rules and scenarios on them.
It does not say why: the stakeholder needs the rules answer live only in the
change's documents, and future documents will not be structured enough to
point at. This plan adds needs to the design document, links every rule to
the needs it answers, and categorises rules so the ones that are not domain
truths (quality targets, constraints) have a place, modules included.

The agent extracts needs and rules from the documents; a requirement is a
rule of the design. There is no separate requirement entity. A view that lays
a design document out like a requirements document builds on this plan and
has its own: `design-doc-requirements-view.md`.

## Decisions

| Topic                | Decision                                                                                                                                                                                                                                    |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Where needs live     | In the design document, as a top-level change set `needs`. The system model never holds them, so only `added` is valid today; `modified` and `removed` fail as `unknownElement`, through the existing check, until a needs catalogue exists |
| Requirement          | A rule. Name is the title, description the statement, scenarios the verification. One rule states one requirement: rules are never merged                                                                                                   |
| Modified rule        | Its `description` is always the whole new statement, never a change note. Why it changes goes in the design document's `description`; `rationale` says why the rule holds, not why it changed                                               |
| Trace                | A rule names the needs it answers in `needs`. An added rule always writes it; `[]` marks a design decision no need asks for                                                                                                                 |
| Rationale            | A rule's `rationale`: why the rule holds. Optional, so a rule whose source gives no reason is not forced to invent one                                                                                                                      |
| Rule categories      | `category`: `Business`, `Quality` or `Constraint`. `ruleType` names the kind within the category; the validator refuses a type of another category                                                                                          |
| Business rules       | Today's rule types: `Consistency`, `Structure`, `Computation`, `State change`. On a building block or a behaviour only, never on a module                                                                                                   |
| Quality rules        | A measurable quality the system must have. Types follow ISO/IEC 25010: `Performance`, `Security`, `Reliability`, `Usability`, `Compatibility`, `Maintainability`, `Portability`                                                             |
| Constraint rules     | A limit imposed on the solution from outside the domain. Types: `Technology`, `Regulation`, `Interface`, `Organisation`                                                                                                                     |
| Placement            | Quality and constraint rules go on the narrowest element they constrain: a module, a building block or a behaviour. A constraint on a part (a property, an input, an output) goes on the element that owns it. Modules gain `rules`         |
| Authorisation guards | A guard on who may do an operation ("only quality managers create QDocs") is a `Business` / `State change` rule on the behaviour. `Security` is for how the system protects itself (authentication, encryption, audit)                      |
| System model         | `ScannedRule` gains `category` (default `Business`), `ScannedDomainModule` gains `rules` (default `[]`). Needs and rationale stay out of the system model: a scanner cannot find them in code, and the dummy scanner drops them on replay   |
| Stored design docs   | Keep parsing: the new fields prefault to unchanged. A stored design document fails validation only when it is saved again                                                                                                                   |

## Models (`server/backend/src/app/`)

Schemas stay declarative (AGENT.md): every cross-field rule below is a
violation in `design-doc.ts`, not a refinement.

`design-docs/need-id.ts` — a value object (`value-objects` skill): a
lower-case kebab-case slug, unique within the design document
(`start-a-qdoc`). The agent writes it; it is not server-minted.

`system-model/system-model.ts`:

```ts
export const RuleCategory = z.enum(['Business', 'Quality', 'Constraint']);

export const RuleType = z.enum([
  // Business
  'Consistency',
  'Structure',
  'Computation',
  'State change',
  // Quality (ISO/IEC 25010)
  'Performance',
  'Security',
  'Reliability',
  'Usability',
  'Compatibility',
  'Maintainability',
  'Portability',
  // Constraint
  'Technology',
  'Regulation',
  'Interface',
  'Organisation',
]);

/** The rule types each category allows; the validator checks a rule against it. */
export const RULE_TYPES_OF: Record<RuleCategory, readonly RuleType[]> = { … };

export const ScannedRule = z.strictObject({
  name: ElementName,
  category: RuleCategory.default('Business'),
  ruleType: RuleType,
  description: z.string().nullable().default(null),
  scenarios: z.array(ScannedScenario).default([]),
});

// ScannedDomainModule gains:
  rules: z.array(ScannedRule).default([]),
```

`design-docs/design-doc.ts`:

```ts
export const DesignedNeed = z.strictObject({
  id: NeedId,
  name: DesignDocField(ElementName),      // "Start a QDoc"
  stakeholder: DesignDocField(z.string()), // "Quality managers"
  statement: DesignDocField(z.string()),   // "The quality managers need to start a QDoc when …"
});

export const DesignedRule = z.strictObject({
  name: ElementName,
  category: DesignDocField(RuleCategory),
  ruleType: DesignDocField(RuleType),
  description: DesignDocField(z.string()),
  needs: DesignDocField(z.array(NeedId)),
  rationale: DesignDocField(z.string()),
  scenarios: changeSet(DesignedScenario, ElementName),
});

// DesignedDomainModule gains:
  rules: changeSet(DesignedRule, ElementName),

// designDocumentSchema gains, before modules:
  needs: changeSet(DesignedNeed, NeedId),
```

Making `needs` a change set, not a plain array, reuses what is there:
`unchangedFieldsInAddedItems` already demands every field of an added need,
`changesMissingFrom` already refuses a modified or removed one, and a later
needs catalogue fits without a schema change.

## Validation (`design-doc.ts`)

New `DesignDocViolation` reasons, checked in `rulesOfEveryDesign`:

- `unknownNeed` — a rule's `needs` names an id that `needs.added` lacks.
- `ruleTypeOutsideCategory` — a rule's `ruleType` is not in
  `RULE_TYPES_OF[category]`. A modified rule that changes one of the two is
  checked against the scanned rule's other.
- `businessRuleOnModule` — a module rule with the category `Business`.

`OPTIONAL_FIELDS` gains `rationale`. `category` and `needs` stay required on
an added rule, so a design decision is marked deliberately with `needs: []`.

A need no rule traces to is not a violation: the design may leave it to
another change. The skill reports it (step 10).

## Dummy scanner (`adapters/out/scanners/dummy.scanner.ts`)

Replay module rules the way building block rules are replayed, keep
`category` on every flattened rule, drop `needs` and `rationale`.

## Frontend (`server/frontend/src/features/design-docs/`)

The existing model view keeps up with the schema: the element details panel
shows a rule's category, type, needs and rationale,
and a module's rules (`module-sections.tsx`, `rule-sections.tsx`,
`design-doc-outline.ts`).

## Skill (`plugins/claude-code/skills/create-design-doc/`)

`SKILL.md`:

- Step 3 (read the sources) extracts the needs: who needs what, in the
  stakeholder's words, one need per distinct goal.
- Step 5 (design) starts with **Needs**, and **Rules** gain the category, the
  trace and the rationale.
- Step 6 (diff) narrows the change note to properties, inputs, outputs and
  scenarios: a modified rule's `description` is the whole new statement, as a
  modified element's `definition` is the whole new definition.
- Step 8 (working file) lists `needs` beside `modules`, `buildingBlocks` and
  `behaviours`.
- Step 10 (report) names the needs no rule answers and the rules no need asks
  for.

`references/modelling.md`:

- A new **Needs** section: a need is a stakeholder goal, not a solution;
  name it as a goal ("Start a QDoc"); its statement says who needs what and
  when.
- **Rules** rewritten around the three categories, with the placement rule
  and the authorisation-guard example. The bullet "a technical constraint … is
  not a rule", which puts the constraint in a part's description or the
  design document's `description`, goes whole: a latency target is now a
  `Quality` / `Performance` rule on the narrowest element, and a constraint
  on a part is a rule on the element that owns the part.
- One rule per requirement statement: never merge two statements into one
  rule. `needs: []` for a rule only the design asks for; never invent a need
  to justify a rule.

## Steps

1. `NeedId`, `RuleCategory`, the widened `RuleType` and `RULE_TYPES_OF`;
   the new fields on `ScannedRule`, `ScannedDomainModule`, `DesignedRule`,
   `DesignedDomainModule`, `DesignedNeed` and the document. Specs in
   `system-model.spec.ts` and `design-doc.spec.ts` for parsing, including a
   stored design document without the new fields.
2. The three violations and `rationale` in `OPTIONAL_FIELDS`, with specs: an
   unknown need, a type of another category (added and modified rule), a
   business rule on a module, an added rule without `category` or `needs`.
3. The dummy scanner: module rules, `category`, `needs` and `rationale`
   dropped. Specs in `dummy-scanner.spec.ts`; update
   `test/fixtures/design-doc.fixture.ts`.
4. Regenerate the contracts; update `tools/design-doc.example.json` with a
   need, a traced rule, a design decision and a quality rule on a module;
   run the contract specs and the plugin tests.
5. Frontend: model types, details panel, outline and their fixtures.
6. The skill: `SKILL.md` and `references/modelling.md`.
7. Rework `examples/qdoc-java` design doc `2026-10-02-create-a-qdoc` to the
   new shape:
   - the three needs of UC-1, and every rule traced;
   - FR-PRE-006/007/008, now one rule ("The people named at creation are
     assigned to version 1"), split into three rules;
   - the notification delay (TBD-01) as a `Quality` / `Performance` rule on
     `onQDocCreated`, and its sentence taken out of the document's
     `description`;
   - "A failed delivery stops no other" on `onQDocCreated` as `Quality` /
     `Reliability`;
   - "A QDoc is saved and announced together" on `createQDoc` recategorised
     (see Open questions);
   - the blank-title rule as a design decision (`needs: []`), with the
     FR-PRE-001 citation dropped from its scenario.
8. Run lint, tests and knip.

## Not in this plan

- The requirements view: `design-doc-requirements-view.md`.
- A glossary view built from the `definition` of modules, building blocks
  and behaviours; it gets its own plan. Needs and rules carry no definition.
- The source passage a need was extracted from.
- Requirement ids from the source documents.
- Open issues (TBD-n) as their own part of the design document; they stay in
  descriptions.
- A needs catalogue across changes, so a later change can modify or remove a
  need an earlier one added, and scanned rules keep their trace.
- Reworking the discounts examples. Their design documents keep constraints
  in prose until a design is redone with the new skill:
  `examples/discounts-java` holds the Open-Meteo endpoint, timeout and the
  no-retry and no-cache choices in its `description` (`Quality` /
  `Reliability` and `Constraint` / `Interface` rules on
  `OpenMeteoWeatherProvider`); `examples/discounts-dotnet` holds the
  `readonly struct` and `[DddValueObject]` shape in its implementation notes
  (`Constraint` / `Technology` rules).

## Open questions

- The quality and constraint type lists above are a first cut; confirm or
  adjust them before step 1.
- "A QDoc is saved and announced together" (qdoc example): a `Business` /
  `Consistency` rule (every QDoc that exists was announced) or a `Quality` /
  `Reliability` one (save and publish succeed or fail together)?
- Should a rule's `description` become `statement`, as `DesignedNeed` names
  it and this plan calls it? It would make the requirements view read
  straight off the schema; it is a rename of a stored field, like
  `description` to `definition` on elements.
