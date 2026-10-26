# Plan: relations of the system model

The system model holds its relations inside its elements: a building block
lists the blocks it `implements` and its `properties`, each typed with a
`BuildingBlockRef`; a behaviour lists its `input` and `output` the same way,
and the behaviours it `invokes`. There is no `uses` anywhere in the model.
"Uses" exists only in the frontend, derived from the types the properties,
inputs and outputs name, and under that one word the exploration view, the
architecture view and its checks read three different things at once.

This plan names the relations the model holds, drops the derived "uses",
and adds one relation the model did not have:

| Relation                                   | Carries                    | Home in the system model                       | Home in the design document             |
| ------------------------------------------ | -------------------------- | ---------------------------------------------- | --------------------------------------- |
| `BuildingBlock HAS_PROPERTY BuildingBlock` | the property's name        | `ScannedBuildingBlock.properties[]` (as is)    | `DesignedBuildingBlock.properties`      |
| `BuildingBlock USES BuildingBlock`         | nothing                    | `ScannedBuildingBlock.uses: BuildingBlockId[]` | `DesignedBuildingBlock.uses` change set |
| `Behaviour HAS_INPUT BuildingBlock`        | the input parameter's name | `ScannedBehaviour.input[]` (as is)             | `DesignedBehaviour.input`               |
| `Behaviour HAS_OUTPUT BuildingBlock`       | nothing                    | `ScannedBehaviour.output[]` (as is)            | `DesignedBehaviour.output`              |
| `BuildingBlock IMPLEMENTS BuildingBlock`   | nothing                    | `implements` (as is, unchanged)                | `implements` (unchanged)                |
| `Behaviour INVOKES Behaviour`              | nothing                    | `invokes` (as is, unchanged)                   | none (unchanged, decision 12.1)         |

What the new `USES` means is not decided: the scanner is being rebuilt and
will define how it finds it. This plan gives it a home and a word, and
nothing else depends on a meaning. The scanner and the system model builder
are out of scope, except for the one line section 3 names.

## Decisions

| Topic                | Decision                                                                                                                                                                                                                                                   |
| -------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Shape                | Nested fields stay. `properties`, `input` and `output` **are** `HAS_PROPERTY`, `HAS_INPUT` and `HAS_OUTPUT`: the name the relation carries is the entry's `name`. No `relations[]` section; old scans keep parsing                                         |
| `USES`               | `ScannedBuildingBlock.uses: BuildingBlockId[]`, default `[]`, sorted and unique, never the block itself. Direction: the block that uses to the block used. Meaning left to the scanner's redesign; the model treats it as an opaque directed edge          |
| Targets              | A relation target stays a `BuildingBlockRef`: a block, a primitive (`primitive                                                                                                                                                                             | string`) or a collection of one. A primitive reads as a built-in block; a collection is an attribute of the relation, not a target of its own. No data is dropped |
| Design document      | `DesignedBuildingBlock.uses: changeSet(BuildingBlockId)`, the shape `implements` has (`added`, `removed`, no `modified`). Prefaults to empty, so stored documents keep parsing                                                                             |
| Who writes `uses`    | Agents only, through the MCP tools, as with `implements`. The UI shows it and does not edit it. The skills do not ask an agent to fill it until the meaning is fixed; the contract's `.describe()` says so                                                 |
| `invokes`            | Unchanged: in the system model only, drawn and followed in the exploration as today                                                                                                                                                                        |
| Derived "uses"       | Gone as a word and as a relation. The three type relations replace it everywhere it was read: exploration edges and menus, follow-chain, the architecture view's "Speaks in" box, card highlighting, and the checks                                        |
| Edge granularity     | One exploration edge per property, per input and per output, each carrying its name (`has property price`, `has input offer`, `has output`). Two properties of one type are two edges                                                                      |
| Exploration defaults | A diagram opens with `contains`, `uses` and `invokes` drawn. The three type relations are off until toggled                                                                                                                                                |
| Follow-chain         | Every drawn relation, both ways: `hasProperty`/`propertyOf`, `hasInput`/`inputOf`, `hasOutput`/`outputOf`, `uses`/`usedBy`, `invokes`/`invokedBy`. Only non-empty entries show                                                                             |
| Relations box        | A building block gains `Uses`, `Used by`, `Property of`, `Input of`, `Output of` beside `Implements` and `Implemented by`. Forward `HAS_*` stay what they are: the Properties, Input and Output sections. A behaviour's box is unchanged                   |
| Architecture checks  | "Domain depends on no port" is reworded to speak of types ("No property, input or output of a domain block is typed with a port"). A new check "Domain uses no port" reads `uses`. "Type in no contract" reads the three type relations, wording unchanged |
| Builder              | One line: `toBuildingBlock` emits `uses: []`. No rule changes; `docs/plans/code-model-to-system-model.md` records that the builder fills none until its redesign                                                                                           |
| Where this lives     | This document. It also lists the edits to `code-model-to-system-model.md` and `design-doc-architecture-view.md`                                                                                                                                            |

## 1. System model (`server/backend/src/app/system-model/system-model.ts`)

- `ScannedBuildingBlock` gains

  ```ts
  /** The building blocks this one uses, by the scanner's definition; never itself. */
  uses: z.array(BuildingBlockId).default([]),
  ```

  placed after `implements`, before `properties`, so the file reads as the
  table above: what it is, what it implements, what it uses, what it has.

- `.describe()` texts name the relations, since the contract ships to agents
  through `get_newest_system_model`'s output schema and the generated JSON
  Schema: `properties` ("The properties the block has, each a `HAS_PROPERTY`
  relation to the type it is of, named by the property"), `input` ("Each a
  `HAS_INPUT` relation, named by the parameter"), `output` ("Each a
  `HAS_OUTPUT` relation; a result has no name"), `uses`, `implements` and
  `invokes` likewise. The schema stays declarative: no refinement checks that
  `uses` omits the block itself; the sort and the uniqueness are the
  producer's (R10.1), as for `implements`.

- `PrimitiveId`'s description gains one sentence: a primitive is a built-in
  building block, so a property, input or output typed with one is a
  relation to it.

- Nothing else in the backend reads these fields. The store parses with the
  schema, the routes and tools pass whole objects through, search has no
  provider over them.

## 2. Design document (`server/backend/src/app/design-docs/design-doc.ts`)

- `DesignedBuildingBlock` gains `uses: changeSet(BuildingBlockId)`, after
  `implements`. `changesMissingFrom` matches it against the scanned block's
  `uses` by its generic walk, so a `removed` entry the scan does not hold is
  `unknownElement`, as with `implements`; nothing new is written for it.
  Like every ref in the document, an entry is not checked to resolve to a
  block the model or the document names (today's rule for `implements`,
  properties, inputs and outputs; kept).

- `DesignDocumentContent` and the working file follow from the schema. The
  `DESIGN_DOC_SHAPE` text in `adapters/in/mcp/tools/design-doc-shape.ts`
  gains one sentence: `implements` and `uses` are change sets of ids, with
  `added` and `removed` only.

- `stored-design-doc.ts` needs no upgrade: the change set prefaults to empty.

- `tools/design-doc.example.json` gains `"uses": { "added": [], "removed": [] }`
  on one block, so the shipped example shows the field. The four example
  design documents under `examples/` are left as they are; they parse.

## 3. Builder (the one scanner line)

`build-system-model.ts`, `toBuildingBlock`: `uses: []` between `implements`
and `properties`. The output type of `ScannedBuildingBlock` requires the
field, so without this line the backend does not compile. No rule in
`code-model-to-system-model.md` changes; section 7 of this plan records the
note that goes there.

## 4. Frontend: the scanned model read as a graph

`features/system-model/system-model-exploration.ts` is where "uses" is
made today, from property types and behaviour input and output types. It
becomes the one place the frontend names the relations of the system model:

```ts
export type RelationKind =
  | 'contains'
  | 'isPartOf'
  | 'hasProperty'
  | 'hasInput'
  | 'hasOutput'
  | 'uses'
  | 'invokes';

export const RELATIONS: readonly { kind: RelationKind; label: string }[] = [
  { kind: 'contains', label: 'Contains' },
  { kind: 'isPartOf', label: 'Is part of' },
  { kind: 'hasProperty', label: 'Has property' },
  { kind: 'hasInput', label: 'Has input' },
  { kind: 'hasOutput', label: 'Has output' },
  { kind: 'uses', label: 'Uses' },
  { kind: 'invokes', label: 'Invokes' },
];

/** A relation between two elements, with the name it carries when it has one. */
export interface Relation {
  kind: DrawnRelationKind;
  source: string;
  target: string;
  /** The property's or the input's name; null for an output, a use, a call. */
  name: string | null;
}

export interface Exploration {
  elements: ExploredElement[];
  relations: Relation[];
}
```

- `explorationOf` builds `hasProperty` from `block.properties` (one per
  property whose type names a block, through collections, the block itself
  left out), `hasInput` and `hasOutput` from `behaviour.input` and
  `behaviour.output` the same way, `uses` from `block.uses`, and `invokes`
  as today. The pairs `uses` and `invokes` keep the "each pair once" rule;
  the three type relations keep one edge per entry, so their ids carry the
  name: `hasProperty:A->B:price`.

- `RELATION_WORD` gives each drawn relation its edge word: `has property`,
  `has input`, `has output`, `uses`, `invokes`. The edge label is the word,
  then the name when there is one (`has property price`). `relation-edge.tsx`
  reads `relation.name`; `exploration-view.tsx`'s `relationEdge` composes
  the label.

- `Reach` grows to ten: `contains`, `isPartOf`, `hasProperty`, `propertyOf`,
  `hasInput`, `inputOf`, `hasOutput`, `outputOf`, `uses`, `usedBy`,
  `invokes`, `invokedBy`. `neighboursOf` fills the reverse of each from the
  relation list. A neighbour reached through two properties is listed once
  per reach (the menu adds elements, not edges).

- `CHAIN_REACHES` is every reach but containment; `relationOfChain` maps a
  reach and its reverse to the drawn relation. `chainOf` is unchanged in
  logic: `throughBehaviours` holds for `invokes`/`invokedBy` and now also for
  `hasInput`, `inputOf`, `hasOutput`, `outputOf`, since only behaviours have
  inputs and outputs, so a block's are its behaviours'. `hasProperty` and
  `uses` are block-to-block and need no walk through behaviours.

- `graphOf` draws each relation kind the reader asked for, type relations
  included, with the same `apart` rule (nothing between a card and the frame
  it is drawn in).

- `EDGE_COLOR` (`relation-colors.ts`) gains three colours; the three type
  relations share one hue in three tints or one hue outright, which the
  design pass decides (the `design-system` skill). `relation-list.tsx` and
  `visibility-panel.tsx` list seven relations from `RELATIONS`; the menus'
  `REACH_ACTION` in `element-node.tsx` grows to ten labels: `Has property`,
  `Property of`, `Has input`, `Input of`, `Has output`, `Output of`, `Uses`,
  `Used by`, `Invokes`, `Invoked by`.

- The default relation set in `exploration-view.tsx` stays
  `['contains', 'uses', 'invokes']`, but `uses` now means the model's
  `uses`. The session's undo steps (`exploration-steps.ts`) hold relation
  sets by name; a step from before this change that names `uses` reads as
  the new relation, which is acceptable for a session-kept list. Nothing
  about relations is in `localStorage` (`exploration-memory.ts` keeps
  elements only), so no stored choice needs resetting.

- The module comment at the top of the file is rewritten to the table above.

## 5. Frontend: the design document read as an architecture

`features/design-docs/architecture-outline.ts` and
`design-doc-architecture.ts`:

```ts
export interface PlacedElement<…> {
  …
  /** The blocks it or its behaviours are typed with: one per property, input and output, collections unwrapped, itself left out. */
  typedWith: TypedWith[];
  /** The blocks the design says it uses (a building block; a behaviour has none). */
  uses: BuildingBlockId[];
  rules: PlacedRule[];
}

export interface TypedWith {
  relation: 'hasProperty' | 'hasInput' | 'hasOutput';
  /** The property's or the input's name; null for an output. */
  name: string | null;
  block: BuildingBlockId;
  /** The behaviour the input or output is on, when the element is its block. */
  behaviour: BehaviorId | null;
}
```

- `blockElement` fills `typedWith` from the block's properties and its
  behaviours' inputs and outputs, and `uses` from `valueOf`-read
  `block.uses` (`added` minus `removed`, through `writtenIn`-style helpers
  in `change-set.ts`). `behaviourElement` fills `typedWith` from its own
  inputs and outputs and `uses: []`.

- `architecture-checks.ts`:
  - `domainDependsOnNoPort`: reads `typedWith`, same logic, pass text "No
    property, input or output of a domain block is typed with a repository,
    an external integration or an application service", warning text
    "`Order` has property `repo` typed with `OrderRepository`; …: the domain
    core reaches out past its ports."
  - new `domainUsesNoPort`: reads `uses` of the domain core against the
    ports; pass text "No domain block uses a repository, an external
    integration or an application service", warning text "`Order` uses
    `OrderRepository`: the domain core reaches out past its ports." It
    passes vacuously while no design holds `uses`.
  - `typeInNoContract`: reads `typedWith`, texts unchanged.
  - The module comment drops "The document has no calls, so nothing here
    says which service uses which port — only what the types already give
    away" and says instead what each check reads.

- `architecture-selection.ts` highlights `typedWith` blocks and `uses`
  blocks as related. `element-findings.tsx` replaces the one "Speaks in"
  box with `ElementRelations` rows `Has property`, `Has input`, `Has
  output`, `Uses`, each row's items the blocks (a block named by two
  properties listed once, as `ElementRelations` lists types). The row
  labels match the exploration's `RELATIONS` labels; the two features do
  not share code (a feature is reached through its api/model only), so the
  labels are typed once in each and a test asserts they agree.

- `inferredFlowOf` is unchanged: it is a guess from types, not a relation,
  and the design document still has no calls.

- `architecture-details.tsx`'s "Not checked" sentence is reworded: calls
  between behaviours are still not in the document; which block uses which
  port is, when the design writes `uses`.

## 6. Frontend: element details and the model tree

- `features/design-docs/ui/element-details/change-list-items.ts` gains,
  beside `implementerItems`, `userItems(doc, id)` (blocks whose `uses`
  names the id), `usedItems(block.uses)` through `refItems`, and
  `typedWithItems(doc, id, relation)` (for `propertyOf`: every block with a
  property typed with the id, through collections; for `inputOf` and
  `outputOf`: every behaviour with an input or output typed with it). Each
  item's `path` is the element's tree path, so the link opens its row.

- `element-detail.tsx` passes seven rows to `ElementRelations` for a
  building block: `Implements`, `Implemented by`, `Uses`, `Used by`,
  `Property of`, `Input of`, `Output of`. Empty rows render nothing, as
  today. A behaviour's rows are unchanged (none).

- `features/system-model/system-model.model.ts` `designOf` maps
  `uses: { added: block.uses, removed: [] }`, so the system model's Model
  tab shows the same rows.

- `design-doc-edit.ts`: `PartKind` gains nothing for the UI, but
  `PART_SET` and `TYPED_PART` gain `uses` beside `implements` so
  `applyEdit` can carry a document that holds it without dropping it
  (`setAt`/`locationOf` are generic; a test proves a round trip keeps
  `uses`). No unit editor button is added: agent-only, like `implements`.

- The model tree, outline and search do not change: `uses` is a relation,
  not a part, and has no row, as `implements` has none.

- `element-tooltip.tsx` is unchanged.

## 7. Documents

- `docs/plans/code-model-to-system-model.md`:
  - Section 11's table gains a row: `BuildingBlock USES BuildingBlock`,
    "not derived by this builder; the scanner's redesign defines it",
    home `ScannedBuildingBlock.uses`. The first two rows are reworded to
    name `HAS_PROPERTY`, `HAS_INPUT` and `HAS_OUTPUT` as the homes of the
    old `UsesObject` relations.
  - Section 12 gains decision 14: "`uses` is in the system model as an
    opaque edge, emitted empty by this builder; its derivation is the new
    scanner's". R10.1 lists `uses` among the sorted fields.
- `docs/plans/design-doc-architecture-view.md`: the decisions table's
  "Checks" row, the checks table (lines 95–97), the `PlacedElement` sketch
  (lines 139–140) and "Not in this plan" (lines 211–216) are updated to
  `typedWith` and `uses`, and the open question "whether a `calls` field
  belongs in the design document" stays open.
- `docs/arch/ARCHITECTURE.md`: no change; it does not describe fields.
- `AGENT.md`: no change.

## 8. Skills and contracts (`plugins/claude-code`)

- `create-design-doc/SKILL.md` and `update-design-doc/SKILL.md`: the list of
  a block's parts names `uses` beside `implements` as "a change set of
  block ids; leave it empty — what a block uses is the scanner's to find and
  its meaning is not yet fixed". The diff rules (an entry added or removed
  by id) are those of `implements`.
- `create-design-doc/references/modelling.md`: one sentence after the
  `implements` paragraph, same message.
- `implement-java-spring/references/mapping.md`: `uses` maps to nothing;
  one line says so in the diff-semantics section.
- `update-design-doc/scripts/human-fields.ts` `keyOf`: no change for
  `uses` (ids are strings). The noted mismatch for a `{ collectionOf }` key
  (array index there, `JSON.stringify` on the server) is pre-existing and
  out of this plan; it is listed under gaps.
- Contracts regenerate from the schemas (`bun run build`); `contracts.ts`
  needs no new line.

## 9. Tests

Backend (`server/backend/test`):

- `unit/system-model.spec.ts`: `uses` defaults to `[]`, holds
  `BuildingBlockId`s only, and the JSON-schema description names the
  relation.
- `unit/design-doc.spec.ts`: `uses` change set parses, prefaults, a
  `removed` entry the scan lacks is `unknownElement`, a stored document
  without `uses` loads.
- `unit/system-model-builder.spec.ts`: every built block has `uses: []`.
- `unit/contracts-json-schema.spec.ts`: unchanged in logic; the snapshot of
  the design-document and system-model schemas gains the field.
- `fixtures/design-doc.fixture.ts`: one block with `uses`.

Frontend (`server/frontend/test`):

- `system-model-exploration.spec.tsx` (23 mentions of uses): the relation
  builder yields one `hasProperty` per property with its name, `hasInput`
  and `hasOutput` per behaviour, `uses` from the field, `invokes` as before;
  `neighboursOf` fills the ten reaches; `graphOf` draws what is asked;
  `chainOf` through behaviours for input and output reaches; the card
  menu lists ten labels.
- `design-doc-architecture.spec.ts` (9 mentions): `typedWith` entries with
  relation and name, `uses` from the change set, the new check passing
  vacuously and warning on a domain block that uses a port.
- `architecture-view.spec.tsx`, `element-detail.spec.tsx`: the relation
  rows by label.
- `design-doc-edit.spec.ts`: a document with `uses` survives `applyEdit`.
- `system-model.model` (`designOf`): `uses` mapped.

## 10. Gaps, tricky parts, decisions still open

Gaps found while reading:

- **The design document never checks a ref resolves.** `implements`,
  property, input and output types, and now `uses`, may name a block
  neither the model nor the document holds; only a modified or removed
  change-set entry is checked. The reverse relations in the relations box
  and the exploration graph silently drop a dangling id. Not changed here;
  a resolution check is a plan of its own.
- **`human-fields.ts` `keyOf` and the server's `keyOf` disagree** on a
  result typed with a collection (array index vs `JSON.stringify`). A human
  edit on such an output's description can be refused as not kept.
  Pre-existing; out of scope.
- **A behaviour's `output` is keyed by its type**, so `HAS_OUTPUT` carries
  no name and two results of one type cannot be told apart. The schema
  already allows several results; the relation follows the schema.
- **The follow-chain's "next element of its own type"** compares groups
  (building block type or behaviour type). Followed through `hasInput` from
  a value object, the chain walks behaviours and ends at the next value
  object their outputs name, which is the intended reading; it is spelled
  out in the spec so it is not read as a bug.
- **`BuildingBlockRef` cannot say a dictionary** (decision 12.7). A
  property typed with a map has no relation. Unchanged.

Tricky parts:

- **Two meanings of `uses` in one codebase during the change.** The
  frontend's derived `uses` and the model's `uses` must not coexist under
  one name for a single commit: the exploration and the architecture code
  rename the derived one first (`typedWith`, the three relations), then the
  field arrives. The steps in section 11 are ordered so.
- **`ElementRelations` lists types, not edges.** A block named by two
  properties shows once in `Has property`; the exploration draws two edges.
  Both are right for their surface; the text of this plan says so where a
  reader could expect the counts to match.
- **The `.describe()` texts ship.** Wording in `system-model.ts` and
  `design-doc.ts` is read by agents through the JSON Schema; the relation
  names (`HAS_PROPERTY` and so on) must be spelled there exactly as in this
  plan, so the skills, the schema and the UI say one thing.
- **Labels typed twice.** The exploration (`system-model` feature) and the
  architecture view (`design-docs` feature) cannot import each other's
  `ui/`; a label such as `Has property` lives in each. A frontend test
  asserts both lists agree, as `architecture-outline.ts` already does for
  its kinds.
- **Vacuous pass of "Domain uses no port".** Until a scan or an agent fills
  `uses`, the check passes on every design and could mislead a reviewer.
  Its pass text says what it looked at ("No domain block uses …; the
  design names no uses"), the way "Caller unknown" does.

Open, to decide at implementation review:

- The colours of the three type relations in the exploration (one hue or
  three): the design pass under the `design-system` skill.
- Whether `hasInput`/`hasOutput` edges are drawn from the behaviour card or
  from its block when the behaviour is not drawn. Today an edge to a hidden
  element is left out, not moved; this plan keeps that rule.

## 11. Steps

Each step leaves `bun run ci` green.

1. **Rename the derived relation in the frontend.** Exploration: `uses`
   becomes `hasProperty`, `hasInput`, `hasOutput` with names, one edge per
   entry; reaches, chains, menus, colours, labels. Architecture:
   `PlacedElement.uses` becomes `typedWith`; checks and texts reworded;
   "Speaks in" becomes three rows. Specs updated. No backend change; the
   word "uses" leaves the frontend.
2. **Add `uses` to the system model.** Schema, describes, the builder's one
   line, backend specs, contract snapshot. Exploration reads `block.uses`
   as the `uses` relation; `designOf` maps it.
3. **Add `uses` to the design document.** Schema, `DESIGN_DOC_SHAPE`,
   example file, fixture, specs. Architecture: `PlacedElement.uses`, the
   new check, selection and findings rows. Element details: the five new
   rows. `design-doc-edit.ts` carries the field.
4. **Documents and skills.** Sections 7 and 8.
5. **Check the examples.** Open `examples/discounts-java` and
   `examples/qdoc-java` in the app: the exploration with the type relations
   toggled, a value object's `Property of` and `Input of` rows, the
   architecture checks of `2026-10-02-create-a-qdoc`.

## 12. Implementation notes

Done as planned, with these choices made on the way:

- The exploration's relation list is one `relations: Relation[]` with
  `kind`, `source`, `target` and `name`; an edge's id carries the name
  (`hasProperty:A->B:price`), so two properties of one type are two edges.
- A chain followed from a block over `inputOf`, `propertyOf` or `usedBy`
  reaches the behaviours or blocks that take it and stops there: a
  behaviour has no `inputOf` of its own, so the chain is one step long
  unless the behaviour's block is of the starting type, in which case that
  block is reached too.
- The exploration's edge colours: `hasProperty` teal, `hasInput` cyan,
  `hasOutput` indigo, `uses` the brand colour, `invokes` grape.
- "Domain depends on no port" names the relation in its warning: "Order
  has property repo typed with OrderRepository", "Order has output typed
  with Orders on price".
- The relation labels are typed once in each feature (`RELATION_LABEL` in
  `architecture-outline.ts`, `RELATIONS` in `system-model-exploration.ts`)
  and spelled the same; no test joins the two, as the features cannot
  import each other's modules without crossing a boundary.
- The edit model (`design-doc-edit.ts`) gained no `uses` unit: `applyEdit`
  carries the field untouched, which a spec proves.

## Not in this plan

- How the scanner finds `USES`, and what it means; the builder stays as it
  is but for the one line.
- Editing `uses` or `implements` from the UI.
- `invokes` in the design document (decision 12.1 stands), and any `calls`
  edge in the architecture view.
- A check that a ref resolves.
- A dictionary type in `BuildingBlockRef`.
