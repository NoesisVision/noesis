# Plan: slots on cards

The exploration draws a building block's state, and a behavior's input and
output, as edges to a card of the type (`has_state`, `has_input`,
`has_output`). Two behaviors and one value object take seven edges and six
type cards. This plan draws those slots on the card that holds them, as
badges, and takes the type cards off the diagram. A badge opens a popup that
walks from its type to what that type relates to, and on, as deep as the
reader goes.

Two things were tried behind switches in the toolbar and are settled: slots
are always drawn on cards (the `Slots: On cards / As nodes` switch, and the
edges and type cards it brought back, are gone), and the badges are always
the card's signature (of the Labels, Signature and Chips looks). The rows
below say what is built; the steps at the end say how it was got to.

The prototype is `slots-on-cards.prototype.html`, drawn from the
`examples/discounts-java` scan (published as an artifact while it was
designed). Its Badge and Popup pickers show the variants that were weighed;
the chosen ones are marked.

## Decisions

| Topic               | Decision                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| ------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Where               | The system-model exploration only. The architecture diagram does not draw these relations as edges, so nothing changes there                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| Badge               | One per slot, in the card's signature: its name, quiet, then its type in bold, underlined; how many it holds is the cardinality mark after the type (`CardinalityMark`: ✱ many, ? optional, none for exactly one), never `[*]`, as everywhere in the app (frontend skill). After the type, a faint ↗ in the badge's colour for a type with a card of its own. Read out as `products: DiscountedProduct, many`; its tooltip, plain text, writes `products: DiscountedProduct [*] · state`                                                                                                                                                             |
| Badge rows          | Under the card's name and kind, its signature in monospace, in a box, without the name the card shows and with the output by type alone: `(offer: Offer, user: UserId) → DiscountedOffer`. Inputs in their position order, one to a line past 370px, the output after the closing bracket; then state, a field to a line. A behavior that gives nothing back, its output asked for, writes a gray `void` (tipped "No output") where its output's type would be, `(offer: Offer) → void`, with no input either `() → void`; any other relation with no slot writes nothing. The layout makes each card the room its signature needs, up to 420px wide |
| Badge colour        | The relation's edge tokens: `--noesis-diagram-edge-{state,input,output}` for the border and fill, `…-word` for the text. No new colour                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| Duplicates          | A type used by several slots shows on every card that uses it                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| Primitives          | A badge like any other (`result: boolean`), but words, not a button; it opens nothing                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| Which cards leave   | An element leaves when it is the target of a drawn slot relation, the reader did not put it in by name — only by following a slot from a card (a card's has state / has input / has output, or that chain), which `picks.bySlot` remembers — it has no drawn relation other than slot relations, and nothing is drawn inside it. Every card in the app is a pick, so how it came is what tells them apart. Put in by name later (the picker), it comes out as a card. A choice saved before has no `bySlot`, so its cards stay                                                                                                                       |
| A type that stays   | Its card stays and the slot's edge is dropped. The badge is marked ↗ ("also on the diagram")                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| The switch          | None. Slots are on cards for every diagram; the `Slots: On cards / As nodes` control was tried and taken out, with the edges and type cards it drew                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| Undo                | Nothing of how slots are drawn is a step. Steps kept while it could be (stored as version 1) are not read: they hold cards for types that are badges now. What was drawn is kept as the choice is, and placed afresh                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| Default             | On cards, always                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| Relation filter     | Unchecking `state`, `input` or `output` hides that relation: its badges on the cards                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| Popup               | A popover from the badge. Header: its type as a card names it — the kind's icon, the type's name, its cardinality mark — and under it the kind (`Value Object`); not the slot, which the badge already says. Then the path, then columns                                                                                                                                                                                                                                                                                                                                                                                                             |
| Popup path          | The path from the badge's slot as dotted tokens, `result.products.discountAmounts`. Every step but the last goes back to it. No filter field                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| Badge looks (trial) | Settled: the signature. Labels (a row per relation, each badge its name over its type) and Chips (one flow of `offer: Offer` chips, an S / I / O letter for the relation) were tried beside it through a Badges switch, and taken out with the switch. Variants explored in an artifact (A–F); B and E built                                                                                                                                                                                                                                                                                                                                         |
| Popup views         | A switch at the title's end draws the walk four ways: Columns (as below), Tree (drawn as the model tree is, from `shared/ui/tree`: its rails, elbows, chevrons and row; each relation an item of its own, its slots one-line rows opening in place), One at a time (the type the walk is at, full width, sliding in on and back, under the path) and Nested cards (a slot card opens into a box of its type's own cards). The tree and the nested cards open along the walk so far. The choice is kept in `sessionStorage`, so the next popup, from any badge, opens the same way                                                                    |
| Popup columns       | One column per step, as in a file browser, on the canvas's soft ground. A column shows the slot the walk came in by, its type and kind, then its rows grouped `state`, `input`, `output`. A relation with no slot is not drawn; a type with none says "nothing inside" under its name. Clicking a row opens the next column and drops the ones after; the strip scrolls to the newest                                                                                                                                                                                                                                                                |
| Popup motion        | Only a change in how many columns there are moves anything. A column added at the walk's end grows out and fades in; columns past its new end (a path step gone back to, ←) fold away, kept drawn, inert, until their transition ends. A column taken by another slot is swapped where it stands, at full width, what it holds fading in, so clicking through a column's slots never moves the strip. Transitions of width (`@starting-style` to open), so a column turned round halfway goes back from where it is; one left before it grew goes at once. With reduced motion all take a millisecond                                                |
| Popup size          | Two columns wide (2 × 280px and the line between), whatever the walk's depth: a longer walk scrolls across, its newest column in view. The same height from step to step: the columns 320px tall, each scrolling what it holds inside, the room for its scrollbar kept so no card is under one, and the path one line that scrolls across, kept at its newest step                                                                                                                                                                                                                                                                                   |
| Popup rows          | Slot cards, as the badges on the canvas: tinted in the relation's colour, the slot's name quiet over its type in bold, a faint chevron where it leads on. An input or output names its behavior: `apply · result`. The card the walk took is ringed; a primitive is drawn in dashed outline and leads nowhere                                                                                                                                                                                                                                                                                                                                        |
| Depth               | No limit. A row whose type is already on the path is marked ↺ and still opens                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| Popup is read-only  | It only shows the model, with one way out: when the badge's type has a card of its own (↗), a ↗ icon after the type in the header, named and tipped "Go to DiscountedOffer on the diagram", closes the popup, takes that card in hand and brings it into sight                                                                                                                                                                                                                                                                                                                                                                                       |
| Selection           | The dimming rule holds (`--noesis-diagram-dimmed`). Selecting a card that is a slot's type gives the badges of that type the related look and keeps their cards clear                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |

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
  `explorationOf` carries the slots (`Exploration.slots`), and `graphOf`
  leaves out the slot relations and, by the rule in Decisions, the elements
  that are on the diagram only as a slot's type, and returns each drawn
  element's badges
  (`ExplorationGraph.badges`): its slots of the relations asked for, each
  marked when its type is still on the diagram.

## The view

| Piece            | Where                                                                                                                                                                                                                                               |
| ---------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Step and storage | `exploration-steps.ts`: a step keeps `bySlot` with its picks, and nothing of how slots are drawn. Stored as version 3; earlier versions are not read (version 2 held cards narrower than their names from further off)                              |
| State, undo      | `exploration-view.tsx`: the graph is always drawn with slots on cards; `goTo` restores a step's choice, relations and direction                                                                                                                     |
| Switch           | None (tried, and taken out)                                                                                                                                                                                                                         |
| Badges           | `ui/exploration/slot-badges.tsx` + `slot-badges.module.css`, rendered by `element-node.tsx` under the name; the signature's lines are read from `badge-signature.ts`. Each badge typed by a block an `UnstyledButton` with `aria-haspopup="dialog"` |
| Card size        | `layout-exploration.ts`: `cardSizeOf(element, { badges })` replaces the fixed `HEIGHT` for a card with badges: as wide as its signature's longest line, up to 420px, and a line taller for each line of it. Pure                                    |
| Popup            | `ui/exploration/slot-explorer.tsx` + `slot-explorer.module.css`: `Popover`, the path, then the columns in a horizontal `ScrollArea`                                                                                                                 |
| Selection        | `exploration-reading.ts`: a badge is related when its type is selected                                                                                                                                                                              |

No new Mantine component is needed: `Popover`, `ScrollArea`,
`SegmentedControl`, `UnstyledButton`, `Tooltip` and `Text` are already
wrapped. One token changes in `design-system/theme.ts`: a behavior's pill
is `--noesis-diagram-pill-radius` (28px, half a card's height) instead of
999px, so a card of one line keeps its round ends and a taller one, with
badges, has rounded corners. That is a `/design-sync`.

A card's badges sit beside its button, laid over the card as its corner
controls are, since a button holds no other control. A frame carries its
own state under its name, its top as tall as they need (`--frame-top`).
In step 4 a badge is a list item with a tooltip; step 5 makes the ones
with a type to walk into buttons.

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

One green commit each (`bun run ci`). As it was built: steps 3 and 4 speak
of the switch and of rows of badges, both since replaced (see Decisions).

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
4. **Badges on cards.** `slot-badges.tsx`, card sizing in the layout, the
   default for a new diagram turned to on cards (as nodes until then),
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
