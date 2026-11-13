# Plan: slots on cards

The exploration draws a building block's state, and a behavior's input and
output, as edges to a card of the type (`has_state`, `has_input`,
`has_output`). Two behaviors and one value object take seven edges and six
type cards. This plan draws those slots on the card that holds them, as
badges, and takes the type cards off the diagram. A badge opens a popup that
walks from its type to what that type relates to, and on, as deep as the
reader goes. One switch in the toolbar brings the edges and type cards back,
and it is a step the diagram can undo.

The prototype is `slots-on-cards.prototype.html`, drawn from the
`examples/discounts-java` scan (published as an artifact while it was
designed). Its Badge and Popup pickers show the variants that were weighed;
the chosen ones are marked.

## Decisions

| Topic              | Decision                                                                                                                                                                                                                      |
| ------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Where              | The system-model exploration only. The architecture diagram does not draw these relations as edges, so nothing changes there                                                                                                  |
| Badge              | One per slot, `name: Type`, then the cardinality when it is not exactly one: `offer: Offer`, `products: DiscountedProduct [*]`. The tooltip adds the role: `user: UserId · input 2`                                           |
| Badge rows         | Under the card's name and kind, one row per relation, labelled `input`, `output`, `state`. Inputs in their position order. A row with no slot is not drawn                                                                    |
| Badge colour       | The relation's edge tokens: `--noesis-diagram-edge-{state,input,output}` for the border and fill, `…-word` for the text. No new colour                                                                                        |
| Duplicates         | A type used by several slots shows on every card that uses it                                                                                                                                                                 |
| Primitives         | A badge like any other (`result: boolean`), with no caret; it opens nothing                                                                                                                                                   |
| Which cards leave  | With slots on cards, an element leaves when it is the target of a drawn slot relation, the reader did not add it by hand, it has no drawn relation other than slot relations, and nothing is drawn inside it                  |
| A type that stays  | Its card stays and the slot's edge is dropped. The badge is marked ↗ ("also on the diagram")                                                                                                                                  |
| The switch         | One `Slots: On cards / As nodes` segmented control in the exploration toolbar, for the whole diagram. No per-card or per-slot switching                                                                                       |
| Undo               | Each flip is one diagram step, kept with the step's choice, relations and direction. Undo and redo flip it back with the cards where they stood                                                                               |
| Default            | On cards for a new diagram. A step stored before this change has no `slots` and opens as nodes, as it was drawn                                                                                                               |
| Relation filter    | Unchecking `state`, `input` or `output` hides that relation either way: its edges as nodes, its badge row on cards                                                                                                            |
| Popup              | A popover from the badge. Header: the slot as written and its role and kind (`offer: Offer` / `Input 1 · Value object`). Then the path, then columns                                                                          |
| Popup path         | The path from the badge's slot as dotted tokens, `result.products.discountAmounts`. Every step but the last goes back to it. No filter field                                                                                  |
| Popup columns      | One column per step, as in a file browser. A column shows its type and kind, then its rows grouped `state`, `input`, `output`. Clicking a row opens the next column and drops the ones after; the strip scrolls to the newest |
| Popup rows         | State: `name` and `Type [*]`. Input and output come from the type's behaviors and name the behavior: `apply · discountedOffer`. Input and output headings show only for a type with behaviors; an empty state reads `state —` |
| Depth              | No limit. A row whose type is already on the path is marked ↺ and still opens                                                                                                                                                 |
| Popup is read-only | No actions in it: it only shows the model                                                                                                                                                                                     |
| Selection          | The dimming rule holds (`--noesis-diagram-dimmed`). Selecting a card that is a slot's type gives the badges of that type the related look and keeps their cards clear                                                         |

## The model

What the popup walks is the whole model, not what is drawn, so the slots are
read from the scan once, beside the exploration.

`features/system-model/exploration-slots.ts` (pure, tested):

- `Slot`: `{ relation: 'state' | 'input' | 'output', holder, name, type,
  typeName, cardinality, position }`. `type` is a `TypeId`: a block's id, or
  `primitive|…`. `typeName` is the block's name or the primitive's.
- `slotsOf(model)`: each holder's slots, a block's state and a behavior's
  input then output, inputs by `position`. Read from `has_state`,
  `has_input`, `has_output`, so primitives are kept. `explorationOf` drops
  them today because they join nothing drawn.
- `relationsOfType(slots, type)`: the popup's column for one type,
  `{ state, input, output }`, where input and output are the slots of the
  behaviors the block exposes (`exposes`), each naming its behavior.
  `explorationOf` carries the slots (`Exploration.slots`), and `graphOf` takes
  `slots: 'cards' | 'nodes'`, `'nodes'` when not given. On cards it leaves out
  the slot relations and, by the rule in Decisions, the elements that are on
  the diagram only as a slot's type, and returns each drawn element's badges
  (`ExplorationGraph.badges`): its slots of the relations asked for, each
  marked when its type is still on the diagram.

## The view

| Piece            | Where                                                                                                                                                                         |
| ---------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Step and storage | `exploration-steps.ts`: `DiagramStep.slots`, `StoredStep.slots?`. Missing reads as `'nodes'`                                                                                  |
| State, undo      | `exploration-view.tsx`: `slots` beside `relations`; `goTo` compares and restores it, so a flip is a step through the existing `placements` effect                             |
| Switch           | `exploration-toolbar.tsx`: a `SegmentedControl` (existing wrapper), labelled `Slots`                                                                                          |
| Badges           | `ui/exploration/slot-badges.tsx` + `slot-badges.module.css`, rendered by `element-node.tsx` under the name. Each badge an `UnstyledButton` with `aria-haspopup="dialog"`      |
| Card size        | `layout-exploration.ts`: `sizeOf(element, badges)` replaces the fixed `HEIGHT` for a card with badges. Width up to `MAX_WIDTH`; badges wrap; height adds a line per row. Pure |
| Popup            | `ui/exploration/slot-explorer.tsx` + `slot-explorer.module.css`: `Popover`, the path, then the columns in a horizontal `ScrollArea`                                           |
| Selection        | `exploration-reading.ts`: a badge is related when its type is selected                                                                                                        |

No new Mantine component is needed: `Popover`, `ScrollArea`,
`SegmentedControl`, `UnstyledButton`, `Tooltip` and `Text` are already
wrapped. If that holds, nothing in `design-system/` changes and there is
nothing to `/design-sync`.

### Keyboard and readers

- A badge is a button. Enter opens the popup and focuses the first row of
  the first column; Escape closes it and returns to the badge.
- In a column, ↑ and ↓ move between rows; → opens the row's column and moves
  into it; ← goes back to the column before. The path tokens are buttons in
  the tab order before the columns.
- A row says its relation, name, type, cardinality, and "already on the
  path" when it is marked ↺. A primitive row is text, not a button.
- The ↗ mark on a badge reads "also on the diagram".

## Steps

One green commit each (`bun run ci`).

1. **Slots from the model.** `exploration-slots.ts` with `slotsOf` and
   `relationsOfType`, tested on the discounts-java fixture: positions,
   primitives, behaviors' slots under their block, a type with no state.
2. **The fold.** `graphOf({ slots })`: slot edges out, folded
   elements out, badges per element. Tested: a type added by hand stays, one
   with an `extends` or `works with` edge stays, a frame stays, a value
   object shown only as an output leaves, the relation filter hides a badge
   row.
3. **The step and the switch.** `slots` in the step and in storage, the
   toolbar control, undo and redo. Tested: storage round trip, an old step
   without `slots` opens as nodes, a flip then undo restores the edges and
   the cards' places.
4. **Badges on cards.** `slot-badges.tsx`, card sizing in the layout,
   selection and dimming. Render-to-markup test for a behavior card and a
   value object card: rows, order, `[*]`, ↗, no caret on a primitive.
5. **The popup.** `slot-explorer.tsx`: header, path, columns, ↺, keyboard.
   Render-to-markup test: opening `result: DiscountedOffer` and walking
   `products › discountAmounts › appliedDiscount › apply` round to
   `DiscountedOffer`, marked ↺; a path token goes back; Product shows
   `state —`.
6. **Check in the app.** Light and dark, vertical and horizontal, the
   discounts-java and qdoc-java scans. Screenshots for the PR.

## Out of scope

- Editing slots from the diagram or the popup.
- Slots on the architecture diagram.
- Selecting or adding a type to the diagram from the popup.
- A per-card or per-relation switch.
