# Plan: the exploration view of a design document

The system model has an Exploration view: the scanned model drawn as cards
and edges, nothing drawn until the reader picks it, then grown by name, by
relation and by slot. A design document has nothing like it. Its elements
are only part of the picture: an added behavior sits on a block the model
already has, takes types the model already has, is called by behaviors the
model already has. To review a change, the reader needs those too.

This plan adds a fifth view to a design document, **Exploration**. It opens
on every element the design touches, drawn with what the design does to
each (added, modified, removed), and lets the reader bring in any element of
the system model around them, with the tools the system model's exploration
already has.

## Decisions

| Topic           | Decision                                                                                                                                                                                                                                                                                      |
| --------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Where           | A fifth tab on the design document, `view: 'exploration'`, after Architecture. The same `ExplorationView` the system model uses, not a copy                                                                                                                                                   |
| What it draws   | The **overlay**: the newest system model with the design applied on top. Added elements and relations are put in, modified ones replace the model's, removed ones stay in, marked removed. Ids are shared (`building_block\|discounts.calculation.Discount`), so the overlay is a merge by id |
| Opens on        | Every element the design adds, modifies or removes, plus the modules and blocks that hold them (the ancestors the outline already conjures), so an added behavior is drawn on its block. Nothing else from the model                                                                          |
| Adding context  | Free: the picker, quick add, the reach menu (callers, callees, slots, what it works with) and the slot badges all read the overlay, so they already offer every model element                                                                                                                 |
| Change marks    | A card the design touches carries the change mark the model tree and the architecture cards use (`ChangeMark`, `CHANGE_COLOUR`). A model element brought in for context carries none. A removed card is drawn faded, its name struck                                                          |
| Relation marks  | Phase 2. An added edge in the change's colour, a removed edge dashed and faded. Phase 1 draws relations as the overlay holds them, removed ones left out                                                                                                                                      |
| Details panel   | The panel reads the design document itself (`DesignDocumentContext`, `ChangeMarksContext` = true), so a design element reads as it does in the Model view. A context element reads from the model's design (`designOf(model)`), unmarked                                                      |
| Reset to design | A toolbar action, "Only the design", drops every context element and redraws what the view opens on                                                                                                                                                                                           |
| Memory          | Steps and choice kept per design document (`noesis.designDocs.<id>.exploration`), not the system model's global key. A design element added later is drawn on next open; a context element the model no longer has is forgotten, as `choiceWithin` already does                               |
| No scan yet     | The overlay of an empty model is the design alone; the view works, the reach menu just finds nothing beyond it. A one-line note says "Scan the system model to bring in what the design touches"                                                                                              |
| Editing         | Read-only, as Architecture is. Editing stays in the Model view                                                                                                                                                                                                                                |
| Selection/place | Selected card kept in the address as `expl`, as Architecture keeps `arch`. The details panel centres what it selects (as every diagram does)                                                                                                                                                  |

## How the pieces fit

```
newestSystemModel ─┐
                   ├─ overlayOf(model, doc) ─► { model: SystemModel, changes: Map<id, OutlineChange> }
designDocById ─────┘                                    │
                                                        ▼
                         ExplorationView({ model, changes, opensOn, memoryKey, document })
```

1. **`overlayOf(model, doc)`** (`features/design-docs/design-doc-overlay.ts`,
   pure, tested). Turns each designed element and relation back into its
   scanned shape (the inverse of `designOf`: `valueOf` each field), merges by
   id into the model, and returns the change of every element the design
   touches. Removed elements stay in the model, recorded as `removed`.
   Removed relations are dropped in phase 1.
2. **`opensOnOf(doc, overlay)`**: the ids the design touches and their
   ancestors, as an `ElementChoice` with them `added` by name.
3. **`ExplorationView` takes what it hard-codes today** as props, with the
   system model's values as defaults so its page does not change:
   - `memoryKey` (today `model.id` for steps, a global key for the choice),
   - `opensOn` (today `recallChoice()`, else nothing chosen),
   - `changes` (today none) carried to the cards through
     `ExplorationReadingContext`,
   - `document` and `changeMarks` for the details panel (today
     `designOf(model)` and `false`), with a way to say which document reads
     which element.
4. **`ElementNode`** draws the change mark and the removed look from the
   reading context. Design first (see below).
5. **`DesignDocDetail`** renders `DesignDocExploration` for the new view:
   loads `newestSystemModel`, builds the overlay, keys the view on the
   document id and the model id.
6. **Address**: `exploration` in `DESIGN_DOC_VIEWS` with its icon
   (`IconAffiliate`, as on the system model), `expl` in `DesignDocSearch`.

## Steps

Each a green commit.

1. `overlayOf` and `opensOnOf`, with tests on the `discounts-java`
   weather-based-discount design and its model (added, modified, removed,
   ancestors, a design over an empty model).
2. `ExplorationView` props (`memoryKey`, `opensOn`), defaults keep the system
   model page as it is. Memory module takes the key.
3. The tab: view name, icon, search param, `DesignDocExploration` wired to the
   overlay. No marks yet: the feature is usable from here.
4. Design proposal for the card's change mark and removed look, as a
   prototype (`design-doc-exploration.prototype.html`), approved before 5.
5. Change marks on cards; details panel reading the design for design
   elements.
6. "Only the design" toolbar action.
7. Browser check (headless Chrome against :3000): open the weather-based
   discount design, see its elements marked, bring in a caller from the
   reach menu, reset, reload and find the same diagram.
8. Phase 2, separate PR: relation marks (added/removed edges), and the
   diagram tokens for them in `theme.ts`.

## Open questions

- Removed elements: drawn faded by default, or left out until asked for?
  Plan: drawn, since a removal is part of the change.
- Does the system model's Exploration get anything back from this, e.g. a
  "show a design's changes" overlay picked from a list? Out of scope here.
