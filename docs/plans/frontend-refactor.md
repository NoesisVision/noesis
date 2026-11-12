# Plan: the frontend, shared and split

Status: proposed (November 2026).

The SPA (`server/frontend/src`, 331 modules, about 33,000 lines) grew one
feature at a time. The same pieces now exist in several places: the
diagram canvases, the element-id helpers, and the backend's vocabulary
copied out by hand. A handful of modules have grown past what a reader can
hold in their head. SonarCloud reports no duplication on `main`, because
every copy is just under its threshold. A survey of the code (November 2026) found the copies listed below, and one real bug among them.

This plan has two goals:

- **Extract** what is written more than once.
- **Split** the modules that are too big to read.

It changes no behaviour, except for the few places where the copies
already disagree. Those are listed separately (section 6), each as a
decision.

Scope: `server/frontend/src` and its tests. No backend changes. No new
dependencies.

## 1. Rules for every step

1. **Behaviour stays.** Each step is a move or an extraction. `bun run ci`
   stays green after every commit, and no test changes its expectations,
   only its import paths.
2. **Old files keep exporting what they export today.** A split module
   re-exports everything it exposed, so its 22 importers and the tests
   move over one at a time, or not at all. A re-export that nothing uses
   any more is deleted, and `knip` reports it.
3. **Dependencies point one way.** `import/no-cycle` is already an error.
   Constants computed from another module's constants when the module
   loads (`SET_OF` from `COLLECTION_OF`, `RELATIONS` and `REACHES` from
   `DRAWN_RELATIONS`) stay in the same file as what they come from, so the
   load order cannot break them.
4. **The boundaries stay.** `shared/` imports only `shared/`. A feature is
   reached through its `*.api.ts` / `*.model.ts`. Backend imports stay
   type-only (`AGENT.md`), so the backend's enums are still copied. Each
   copy gets one place to live, with a `satisfies` check and an
   exhaustiveness check.
5. **No drive-by fixes.** Dead code found while moving is noted, then
   removed in a commit of its own. For example, `locationOf` in
   `design-doc-edit.ts` always returns no keys, so the owner-walking
   branches of `setAt` and `updateIn` never run.

## 2. Shared foundations (pure code, best covered by tests)

### 2.1 Element ids: one module, in `shared/`

Today this is `features/design-docs/element-id.ts`, and the system model
feature has its own copy.

- **Move it to `shared/model/element-id.ts`.** Nothing in it belongs to
  design documents.
- **Delete the second `addressOf`** in `system-model-exploration.ts:547`,
  which has an identical body. Also delete `ref-address.ts`, whose
  `refAddressOf` is only an alias.
- **Export what is now written out by hand:**
  - `parentAddressOf`: written 4 times (`search-entries.ts`,
    `element-tooltip.tsx`, `move-modal.tsx`, `change-list-items.ts`).
  - `behaviorLabelOf` ("Block.behavior"): written 3 times.
  - `isBuildingBlock`, `isModule`, `kindPrefixOf`, and the `need|`
    prefix. Today these are typed as literals in `design-doc-edit.ts`
    (3 places), `unit-fields.tsx`, `design-doc-description.ts` and
    `architecture-details.tsx`.
- **Rename the tooltip's `addressOf`.** It turns `name: a.b.C [*]` into
  `a.b.C`, so it's a different function under the same name. It becomes
  `qualifiedOf`, next to `shortName` in `shared/ui/qualified-name.tsx`.
- **Rename the local functions that hide the real helpers:** `ownerOf` in
  `unit-editor-modal.tsx`, `nameOf` in `rule-sections.ts`, and `kindOf`
  in `architecture-diagram.tsx`.

### 2.2 Words for the model

`shared/ui/title-case.ts` becomes the home of every casing rule.

- **`modelWordOf`** ("Value Object") replaces 3 identical bodies:
  `patternLabelOf`, `groupLabelOf`, and the type select in
  `unit-fields.tsx`.
- **`sentenceCase`** ("State change", "Building block") replaces 2
  identical bodies: `ruleKindLabelOf` and `kindLabelOf` in search.
- **Element-kind words** move into one table,
  `ELEMENT_KIND_WORDS: Record<ElementKind, { one: string; many: string }>`,
  beside the element ids. It replaces six tables that repeat the same
  words: `KIND_WORD`, `UNDRAWN_NAME`, `KIND_LABEL`, `UNIT_LABEL`,
  `RULE_PLACE_KIND` and `SECTIONS`.
- **`OPENS_IN` and `OPENS_IN_LABEL`** hold the same text and differ only
  in a capital letter. They become one table.

Section 6.1 asks which casing the model's own words should use. Today
"Building block · Value Object" mixes the two.

### 2.3 The backend's vocabulary: one copy each

Each list lives in one module, checked against the contract's type, and
the subsets are derived from it.

- **`building-block-kinds.ts`** (in `features/design-docs/`):
  - `BUILDING_BLOCK_KINDS`, in the backend's order, checked to be
    exhaustive.
  - A record of each kind's ring (application, domain core, driven port,
    …) and whether it is a value of the domain.
  - Derived from it: `TYPES_OF`, `DOMAIN_CORE`, `DRIVEN_PORTS`, `TYPES`
    (in `architecture-checks.ts`), `BEVELLED` (in `diagram-shapes.tsx`)
    and the block half of `PATTERNS`. The tree's reading order stays its
    own list, but gains the exhaustiveness check.
- **Rule kinds** go in `rules.ts`. This fixes a bug, in its own commit:
  - `kind-icon.tsx` keys its rule icons by stale names ("Consistency",
    "State change").
  - But a rule's tree node carries the raw kind (`state_change`).
  - So every rule falls back to the generic scale icon. The rule icons
    are dead code.
  - The fix keys the icons by `RuleKind`, with `satisfies Record<RuleKind,
    …>`.
- **Relation-kind sets** go in `relations.ts`:
  - Containment is written 3 times: `CONTAINMENT_KINDS`, `CONTAINMENT` in
    the explorer, and `CONTAINS` in `design-doc-edit.ts`. It becomes one
    record keyed by the child's kind, with the set derived from it.
  - Named slots: one list.
  - The "invokes" pair is written 3 times and the "governs" pair twice.
    Each becomes one constant.
  - The system model feature imports these through the design-docs
    `*.model.ts`.
- **Cardinality** goes in `cardinality.ts`. Its wording is spread over
  `cardinalitySuffixOf`, `CardinalityMark`'s `MARKS`, and
  `CARDINALITY_LABEL`, which retypes `[*]` by hand.
- **Kind lists:**
  - `KIND_ORDER` becomes `OUTLINE_KINDS`: the same 11 kinds in the same
    order.
  - `KIND_OF` (in `element-ref.ts`) is derived from `COLLECTION_OF`, of
    which it is the inverse.
  - `isElement` uses `ELEMENT_KINDS` instead of retyping it.

### 2.4 Small utilities

- **`recordOf(keys, valueOf)`** goes in `shared/`. It replaces the 5
  places that write `Object.fromEntries(list.map(…)) as Record<K, V>`,
  and their casts.
- **`byIdOf(list)`** replaces the 5 places that build
  `new Map(elements.map(e => [e.id, e]))`. Where an `OutlineTree` already
  holds the map (`byPath`), the code uses that instead.
- **Change-set helpers**, in `features/design-docs/change-set.ts`:
  - `changed(set)`: added, modified and removed together. Today it is
    private to `change-list-items.ts`.
  - `keysIn(set, keyOf)`.
  - `pointingRelations(doc)`.
  - They replace 7 loops that rebuild the same thing. That includes the
    `named` loop followed by a `removed` loop that `design-doc-outline.ts`
    writes 5 times.

## 3. One kit for the diagram canvases

The three React Flow canvases share behaviour, as the frontend skill says
they must:

- the system model's exploration: `features/system-model/ui/exploration/`
- the architecture diagram: `features/design-docs/ui/architecture/`
- the mermaid canvas: `shared/ui/mermaid-canvas/`

That behaviour is written three times. It moves into a new folder,
`shared/ui/diagram-canvas/`, which keeps company with `diagram-shapes.tsx`,
`canvas-toolbar.tsx`, `canvas-legend.tsx` and `zoom-controls.tsx`.

| Module                      | What it holds                                                                                                                                                                                | Today                                                                                                                                    |
| --------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| `canvas-keys.ts`            | `isElsewhere(target)`; `useLetGoOnEscape(active, onLetGo)`, listening in the capture phase                                                                                                   | 3 versions of the check, which have drifted: the exploration's leaves out menus, the mermaid canvas's leaves out select, tree and dialog |
| `use-canvas-zoom.ts`        | the flow instance, the zoom readout, the `onInit`/`onMove` handlers and the `ZoomControls` props                                                                                             | written identically 3 times                                                                                                              |
| `diagram-flow.ts`           | the shared `ReactFlow` props: `colorMode`, the four `…able={false}`, attribution, letting go on a pane click                                                                                 | near-identical 3 times; `minZoom`/`maxZoom` differ                                                                                       |
| `fit.ts`                    | `FIT`; `useFitAfter` (fit again on the next frame after a layout or resize); `isInSight` (bring into view when off screen)                                                                   | `FIT` identical twice; the next-frame fit twice; bring-into-view twice                                                                   |
| `canvas-background.tsx`     | the dot grid, from tokens                                                                                                                                                                    | 3 copies with different gaps and colours, as literal `light-dark()`                                                                      |
| `hidden-handles.tsx`        | the invisible handles React Flow needs                                                                                                                                                       | TSX 3 times, CSS 3 times                                                                                                                 |
| `elk.ts`                    | the lazy ELK loader                                                                                                                                                                          | identical twice                                                                                                                          |
| `geometry.ts`               | `Rect`, `Point`, `overlaps`, `encloses`, `union`                                                                                                                                             | `Rect`/`Point` 3 times, containment tests twice                                                                                          |
| `edge-paths.ts`             | `borderTowards`, `sideOf`, `roundedPath`                                                                                                                                                     | the exploration's floating edges; the mermaid canvas's `pathThrough`                                                                     |
| `diagram-reading.ts`        | the selection base `{ selected, related, path, clear }`, `stateOf`, `dimmedOf`, `ancestorsOf(ids, parentOf)` and `withSelectionState(label, state)`; each canvas extends its context from it | 3 contexts with 3 ways of walking ancestors, and 2 sets of words for screen readers                                                      |
| `diagram-canvas.module.css` | dimmed cards and edges with their fade, the highlighted edge, the edge-label pill, the hidden handle, card hover and focus, the frame title                                                  | 3 near-identical copies                                                                                                                  |
| `diagram-markers.tsx`       | arrow markers in a normal and a highlight tone, from the mermaid canvas's set                                                                                                                | 3 implementations                                                                                                                        |

In the same step:

- **`DetailsDock`** moves from `features/design-docs/ui/architecture/` to
  `shared/ui/details-dock.tsx`. It is chrome for any canvas, and it
  imports nothing from design documents. A `useDetailsDock()` hook takes
  the "minimized" state that the architecture and the exploration each
  keep beside it.
- **The frontend skill** (`.agents/skills/frontend/SKILL.md`) is updated
  to point at the new homes.

Selection stays each canvas's own: the architecture allows one selected
card, while the other two allow several. Only the reducer the exploration
and the mermaid canvas share, which is identical, moves:
`use-canvas-selection.ts`.

## 4. Splitting the large modules

Each split keeps the original file as the entry point (rule 1.2). Within
each module, the files are listed bottom of the import chain first, and
built in that order.

### 4.1 `features/design-docs/design-doc-edit.ts` (1,421 lines, 22 importers)

1. **`design-doc-unit.ts`**: unit kinds, refs and targets, `UNIT_LABEL`,
   `COLLECTION_OF`, `PART_SET`, `ELEMENT_KINDS`, `CONTAINED_KINDS` and
   `SET_OF`. `SET_OF` and `COLLECTION_OF` sit together because one is
   built from the other when the module loads.
2. **`design-doc-change-sets.ts`**: the loose-set plumbing (`keyOf`,
   `matchesRef`, `fieldOf`, `topSetOf`, `setAt`, `updateAt`, `updateIn`,
   `changesNothing`) and reading a unit (`unitStateOf`, `unitOf`,
   `isWritable`, `isRemoved`).
3. **`design-doc-transforms.ts`**: `contained`, `uncontained`, `joined`,
   `written`, `discarded`, `withoutWithin`, `withoutUngoverned`,
   `untraced`, `renamed`.
4. **`design-doc-moves.ts`**: `canMove`, `movedIdOf`,
   `moveDestinationsOf`, `blocksNamedIn`.
5. **`design-doc-drafts.ts`**: field specs, `TYPES_OF` (now derived from
   2.3), `RULE_KINDS`, `PRIMITIVES`, `UnitDraft` and the draft functions.
6. **`design-doc-draft-errors.ts`**: `draftErrors`.
7. **`design-doc-violations.ts`**: `violationsOf`, `violationsInWords`.
8. **`design-doc-inline-edit.ts`**: `inlineEditOf`, `newRuleOf`.
9. **`design-doc-edit.ts` keeps** `DesignDocEdit`, `applyEdit` and the
   removals, plus re-exports.

Imports point one way: unit → change sets → transforms, moves and drafts →
edit, errors and violations → inline edit. The only link across is from
`applyEdit` to `movedIdOf`. Covered by `design-doc-edit.spec.ts` (845
lines) and `unit-editor.spec.tsx`.

### 4.2 `features/system-model/system-model-exploration.ts` (709 lines, 11 importers)

1. **`exploration-relations.ts`**: the `DRAWN` table and everything
   derived from it when the module loads (`DRAWN_RELATIONS`, `RELATIONS`,
   `RELATION_WORD`, `DRAWN_OF_MODEL`, `Reach`, `REACHES`, the chain
   reaches).
2. **`exploration.model.ts`**: element types, `explorationOf`, the kind
   words.
3. **`exploration-sections.ts`**: the filter's sections.
4. **`exploration-choice.ts`**: picks and choice.
5. **`exploration-graph.ts`**: `graphOf`, `relatedTo`, `removalOf`.
6. **`exploration-reach.ts`**: neighbours and chains.

Covered by `system-model-exploration.spec.tsx`.

### 4.3 `features/system-model/ui/exploration/place-locally.ts` (676 lines)

1. **`canvas-geometry.ts`**: becomes `shared/ui/diagram-canvas/geometry.ts`
   (section 3).
2. **`canvas-workspace.ts`**: `workspaceOf`, kept whole. Its functions
   share one map of rectangles and one counter that caps pushes at 500,
   so splitting it would break that.
3. **`arrange-within.ts`**, and **`move-card.ts`** (`movedTo`,
   `refusingFrames`, `landsIn`).
4. **`place-locally.ts` keeps** `placeLocally`.

Covered by about 15 placement cases. `refusingFrames` and `landsIn` gain
their first tests.

### 4.4 `features/system-model/ui/exploration/element-node.tsx` (690 lines)

- **`exploration-node.ts`**: the `ExplorationNode` type, so that
  `exploration-steps.ts` stops importing a component file for it.
- **`reach-words.ts`**, **`use-reaches.ts`** and **`reach-menu.tsx`**:
  the card's menu, built from the inside out.
- **`node-controls.tsx`**: `Contains` and `Remove`.
- **`use-viewing-from-frame.ts`**.
- **`element-node.tsx` keeps** `ElementNode`.

`NODE_MENU` and `CLICK_SLOP` become exports, because each is used by two
of these files.

### 4.5 `shared/ui/mermaid-canvas/mermaid-canvas.tsx` (1,066 lines)

- **`mermaid-canvas-reading.ts`**, including a pure `readingOf` that can
  be tested.
- **`mermaid-canvas-nodes.tsx`** (the box shapes), **`mermaid-canvas-edge.tsx`**
  (with `pathThrough`, which is pure and now testable) and
  **`mermaid-markers.tsx`**. The marker id scheme becomes one
  `markerUrl` helper, so the edges and the markers cannot drift apart.
- **`use-canvas-width.ts`** and the even Ctrl-zoom hook.
- **`use-step-playback.ts`** (with `step-controls.tsx`). Selection and
  playback stop each other, so the component keeps `onClick` and `letGo`,
  which call into the playback hook.

`NODE_TYPES` and `EDGE_TYPES` stay at module level. React Flow needs them
stable.

### 4.6 `features/system-model/ui/exploration/exploration-view.tsx` (1,534 lines)

This one is done last, because nothing tests it.

- **`exploration-nodes.ts`** and **`exploration-edges.ts`**: `nodeOf`,
  `standingOf` and `edgeOf`, which are pure and can be tested for the
  first time.
- **`use-diagram-steps.ts`**: undo and redo. It takes `placements`,
  `edits` and `restore` from the placement hook, because a ref set just
  before `restore()` ties the two together. It stays one hook.
- **`use-placement.ts`**: the placement hook, moved whole. Its refs
  (`latest`, `settled`, `holding`, `dropGlide`) are shared across all of
  its handlers. It can only be split if they stay in the parent hook and
  are passed down. The comments about strict mode are behaviour and
  move with it.
- **`use-exploration-shortcuts.ts`**: Space, Ctrl+A, Delete and Escape,
  using `canvas-keys.ts` from section 3.
- **`exploration-view.tsx` keeps** the component, at about 600 lines.

### 4.7 `features/design-docs/ui/unit-editor/unit-fields.tsx` (385 lines)

- **`unit-form.ts`** (the field labels and `valueProps`), **`ref-input.tsx`**,
  **`diagram-input.tsx`** and **`field-input.tsx`**.
- **`unit-fields.tsx` keeps** `UnitFields`.

## 5. One link component

The "link to the element's row, or plain text when the tree has no row"
pattern is written 9 times:

- `DeclarationType` and `OutputType`, which are near-identical
- `BehaviorName`, plus an identical copy in `element-cards-section.tsx`
- `TypeLink` and `ElementLink` (an anchor and text variant)
- `change-list-section.tsx`
- `rule-cards.tsx`

It becomes one `ElementLinkOrText` in `features/design-docs/ui/element-details/`,
next to `useElementNavigation`. It takes `path`, `className`, `removed` and
`as: 'plain' | 'anchor'`. `DeclarationType` and `OutputType` merge into one
component that takes a class name.

## 6. Decisions: where the copies disagree

These steps change what a reader sees or does. Each is yours to make before
it is built. Until then the kit in section 3 keeps each canvas's current
behaviour, passed in as a parameter.

1. **Casing for the model's words.** Patterns are title case ("Value
   Object"), while rule kinds and element kinds are sentence case ("State
   change"). Pick one.
2. **Escape on the exploration.** It doesn't listen in the capture phase,
   and it misses menus, both of which the skill asks for. Bringing it in
   line is a behaviour fix.
3. **Ctrl-wheel zoom.** Only the mermaid canvas fixes the Mac's tenfold
   Ctrl-wheel zoom. Should all three canvases have it?
4. **The architecture's edges.** They are straight lines between fixed
   handles. They neither meet the card's border nor highlight with the
   selection, unlike the exploration's. Should they become floating edges?
5. **The mermaid canvas's chrome.** It has no `DetailsDock`, and it
   builds its own toolbar instead of using `CanvasToolbar`. That may be
   deliberate, since the canvas also sits inline in documents.
6. **Tooltips.** The three canvases work three ways: one delegated
   tooltip, one tooltip per card, and `title` attributes.
7. **Literal colours in the diagram stylesheets.** The skill allows
   tokens only. These become tokens in `theme.ts`, which needs
   `/design-sync`:
   - the mermaid canvas's note fill, toolbar and divider
   - the exploration's empty canvas
   - the architecture's ring label
   - the frame-title hover
   - the three dot grids

## 7. Steps

Each step is one pull request, and every commit in it leaves `bun run ci`
green. Pure code goes first, while it is best covered by tests; the hooks
go last.

1. **Foundations** (section 2): element ids, words, vocabulary, utilities,
   change-set helpers. The rule-icon fix is its own commit.
2. **The diagram kit** (section 3), with no change in behaviour, plus the
   `DetailsDock` move.
3. **Pure splits** (4.1, 4.2, 4.3), with the tests' import paths updated.
4. **Component splits** (4.4, 4.7) and the link component (section 5).
5. **The mermaid canvas and exploration view splits** (4.5, 4.6). Each is
   checked by hand in the app, in both schemes, because nothing renders
   them in tests.
6. **The decisions** from section 6, one by one, as each is made.

After each step: the largest module's line count, SonarCloud's duplication
for the pull request, and `knip` showing no re-export left unused.
