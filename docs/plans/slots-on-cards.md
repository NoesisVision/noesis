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
| Popup               | A popover from the badge. Header: its type as a card names it — the kind's icon, the type's name, its cardinality mark — and under it the kind (`Value Object`); not the slot, which the badge already says. Then the tree of what the type relates to                                                                                                                                                                                                                                                                                                                                                                                               |
| Badge looks (trial) | Settled: the signature. Labels (a row per relation, each badge its name over its type) and Chips (one flow of `offer: Offer` chips, an S / I / O letter for the relation) were tried beside it through a Badges switch, and taken out with the switch. Variants explored in an artifact (A–F); B and E built                                                                                                                                                                                                                                                                                                                                         |
| Popup views         | None to choose from: the tree alone. Columns (a column a step, as a file browser has, under a dotted path), One at a time and Nested cards were built beside it behind a switch at the title's end, tried, and taken out with the switch and the choice kept in `sessionStorage`                                                                                                                                                                                                                                                                                                                                                                     |
| Popup tree          | Drawn as the model tree is, from `shared/ui/tree`: its rails, elbows, chevrons and row, on the canvas's soft ground. Each relation the type has a slot of — `state`, `input`, `output` — is an item of its own, open, its word in the relation's colour; a relation with no slot is not drawn, and a type with none says "nothing inside". Under it, its slots as one-line rows: the slot's name, then its type and cardinality mark at the row's end. A row whose type leads on opens in place onto that type's own relations; every slot is shut when the popup opens                                                                              |
| Popup size          | 560px wide, and as tall as what is opened in it: the tree's room grows with its rows up to 360px, then scrolls inside, the room for its scrollbar kept. The room's lower corners are rounded as the popup's are, a border's width inside them, so its ground does not cover the popup's rounded border                                                                                                                                                                                                                                                                                                                                               |
| Popup rows          | An input or output names its behavior: `apply · result`. A primitive's row has no chevron, its type in monospace, and opens nothing                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| Depth               | No limit. A row whose type is already on the way to it is marked ↺ and still opens                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
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

| Piece            | Where                                                                                                                                                                                                                                                                                                         |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Step and storage | `exploration-steps.ts`: a step keeps `bySlot` with its picks, and nothing of how slots are drawn. Stored as version 4, each card by its id, place and size alone; earlier versions are not read (version 2 held cards narrower than their names from further off, version 3 each card whole with its element) |
| State, undo      | `exploration-view.tsx`: the graph is always drawn with slots on cards; `goTo` restores a step's choice, relations and direction                                                                                                                                                                               |
| Switch           | None (tried, and taken out)                                                                                                                                                                                                                                                                                   |
| Badges           | `ui/exploration/slot-badges.tsx` + `slot-badges.module.css`, rendered by `element-node.tsx` under the name; the signature's lines are read from `badge-signature.ts`. Each badge typed by a block an `UnstyledButton` with `aria-haspopup="dialog"`                                                           |
| Card size        | `layout-exploration.ts`: `cardSizeOf(element, { badges })` replaces the fixed `HEIGHT` for a card with badges: as wide as its signature's longest line, up to 420px, and a line taller for each line of it. Pure                                                                                              |
| Popup            | `ui/exploration/slot-explorer.tsx` (the `Popover`'s header) and `slot-tree.tsx` + `slot-tree.module.css` (the tree, on `shared/ui/tree`); what both word alike in `slot-words.tsx`                                                                                                                            |
| Selection        | `exploration-reading.ts`: a badge is related when its type is selected                                                                                                                                                                                                                                        |

No new Mantine component is needed: `Popover`, `UnstyledButton`,
`Tooltip` and `Text` are already wrapped. One token changes in `design-system/theme.ts`: a behavior's pill
is `--noesis-diagram-pill-radius` (28px, half a card's height) instead of
999px, so a card of one line keeps its round ends and a taller one, with
badges, has rounded corners. That is a `/design-sync`.

A card's badges sit beside its button, laid over the card as its corner
controls are, since a button holds no other control. A frame carries its
own state under its name, its top as tall as they need (`--frame-top`).
In step 4 a badge is a list item with a tooltip; step 5 makes the ones
with a type to walk into buttons.

### Keyboard and readers

- A badge is a button. Enter opens the popup; Escape closes it and returns
  to the badge.
- The tree is an ARIA tree with one tab stop, its first row. ↑ and ↓ move
  along the rows; → opens a row, ← shuts it, or from a shut row goes up to
  the row it is under; Enter and Space do either.
- A row says its relation, name, type, cardinality, and "already on the
  path" when it is marked ↺. A primitive's row has nothing to open.
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
