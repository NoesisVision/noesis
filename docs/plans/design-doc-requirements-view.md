# Plan: the requirements view of a design document

A design document is read today as a model: an outline of modules, building
blocks and behaviours, with the rules and scenarios of the element selected.
Once `design-doc-needs.md` is in, the same document also holds the
stakeholder needs and, on every rule, its category, the needs it answers and
its rationale. This plan adds a second view of a design document that lays
that out the way a requirements document does: each need, the rules that
answer it, and for each rule its statement, rationale, trace and
verification. A reviewer who thinks in requirements can then read and check
a design without reading the model.

Builds on `design-doc-needs.md`; nothing here starts before it is in.

## Decisions

| Topic                  | Decision                                                                                                                                                               |
| ---------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| What it shows          | One design document, read-only, rendered by the frontend from the design document alone. Nothing is stored for it and the backend does not change                      |
| Requirement            | A rule of the design: its name is the title, its description the statement, its scenarios the verification                                                             |
| Grouping               | By need. A rule tracing to two needs appears under both                                                                                                                |
| Rules no need asks for | A section of their own, "Design decisions", so a reviewer sees what the design adds beyond the documents                                                               |
| Needs no rule answers  | A section of their own, "Unaddressed needs": the gap list                                                                                                              |
| Missing verification   | Shown, not left out: a rule with no scenario says "No scenario verifies this rule", so a reviewer sees what nothing checks                                             |
| Summary                | A line under the description counts needs, rules, design decisions, unaddressed needs and rules without verification                                                   |
| Details                | Category, subsystem, element, rationale and trace sit in a "Details" disclosure, collapsed by default; verification stays open                                         |
| Statement              | The rule's description as written. The view does not rephrase it into "shall"                                                                                          |
| Subject                | The module the rule's element sits in, by name; the element itself beside it. This is what a requirements document calls the subsystem                                 |
| Numbering              | None. Rules are listed in the order of the model view and named by their rule name                                                                                     |
| Switching              | The view is a search param of the design document route (`view: 'model' \| 'requirements'`, default `model`), so the address names it and Back returns to it           |
| Back to model          | A rule's element links to the model view with that element selected (`node`), so a reviewer goes from a requirement to the design behind it                            |
| Changes                | Only what the design adds or modifies is shown. A modified rule shows the fields it changes and its change note; a removed rule is listed under its element as removed |

## Layout

```
# <design doc name>
<design doc description>
<n> needs · <n> rules · <n> design decisions · <n> unaddressed needs · <n> rules without verification

## <need.name>
> <need.statement>
Stakeholder: <need.stakeholder>

### <rule.name>
> <rule.description>
Change note: <the change note of a modified rule>
▸ Details  <category> · <module name> › <element name>     (collapsed)
  - Category: <category> · <ruleType>
  - Subsystem: <name of the module the rule's element sits in>
  - Element: <the module, building block or behaviour the rule is on>, linked to the model view
  - Rationale: <rule.rationale>
  - Trace: <names of rule.needs>
Verification: <each scenario as given / when / then>, or "No scenario verifies this rule"

## Design decisions
<every rule with needs: [], laid out as above>

## Unaddressed needs
<every need no rule traces to>
```

A field the rule leaves out (no rationale) is left out of its entry, not shown
empty. Verification is the exception: a rule with no scenario shows that it
has none, because an unverified rule is a gap a reviewer must see, as an
unanswered need is.

A rule reads first as what a requirements review checks: its statement and
how it is verified. The rest is reference, so it sits in a "Details"
disclosure that starts collapsed. Collapsed, its line still shows the
category and where the rule lives (`<module> › <element>`), so a reviewer can
place a rule without opening it. On a modified rule whose changed fields are
inside, the line is marked "changed"; the change note stays outside, above
it. A removed rule has no disclosure: its subsystem and element are the
whole entry.

The summary counts each rule once, however many needs it traces to, and
leaves removed rules out. A count of gaps (unaddressed needs, rules without
verification) above zero is marked, so a reviewer sees at a glance whether
the design has any.

## Model (`server/frontend/src/features/design-docs/`)

`design-doc-requirements.ts`, a pure function from a design document to what
the view renders, so it is tested without React:

```ts
interface RequirementsOutline {
  needs: {
    need: DesignedNeed;
    rules: TracedRule[];
  }[];
  designDecisions: TracedRule[];
  unaddressedNeeds: DesignedNeed[];
  summary: {
    needs: number;
    rules: number;
    designDecisions: number;
    unaddressedNeeds: number;
    rulesWithoutVerification: number;
  };
}

interface TracedRule {
  rule: DesignedRule;
  change: 'added' | 'modified' | 'removed';
  element: {
    id: string;
    name: string;
    kind: 'module' | 'buildingBlock' | 'behaviour';
  };
  module: { id: ModuleId; name: string };
}
```

It walks the rules of every module, building block and behaviour, in the
order the outline walks them. A name the design leaves unchanged on a
modified element comes from the system model the model view already loads.

## UI (`server/frontend/src/features/design-docs/ui/`)

- `requirements-view.tsx`: renders a `RequirementsOutline`, following the
  `frontend` skill (design-system wrappers, accessibility rules: headings in
  order, the element link a real link, the "Details" disclosure a real
  button that announces whether it is expanded).
- `design-doc-detail.tsx`: switches between the outline and the requirements
  view by the `view` search param, with a control both views share.
- `routes/_shell/changes/$changeId/design-docs/$docId.tsx`: the `view` param
  in the route's search schema.

## Steps

1. `design-doc-requirements.ts` with specs: grouping by need, a rule under
   two needs, design decisions, unaddressed needs, module rules, a modified
   and a removed rule, element and module names from the system model, and
   the summary: a rule under two needs counted once, removed rules left out,
   a rule with no scenario counted as without verification.
2. The `view` search param and the switch, with a spec that the address
   keeps the view and Back returns to it.
3. `requirements-view.tsx` and its fixtures, among them a rule with no
   scenario and a modified rule whose trace changed; the "Details"
   disclosure, collapsed by default; the link to the model view.
4. Check the view of the reworked `examples/qdoc-java` design doc
   `2026-10-02-create-a-qdoc` against the UC-1 document it was designed from:
   every requirement of UC-1 appears under its need, and the design
   decisions are the ones the design added.
5. Run lint, tests and knip.

## Not in this plan

- Numbers people can quote in review. They would need stable ids on rules,
  which the design document does not have.
- Exporting the view as a file.
- A view across several design documents or changes.

## Open questions

- Whether review needs requirement numbers after all, and where they would
  come from if requirement ids stay out of the design document.
