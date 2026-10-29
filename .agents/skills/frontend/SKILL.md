---
name: frontend
description: Conventions for the Noesis SPA in server/frontend, and the accessibility rules its components must meet. Use when adding or changing anything under server/frontend/src — a view, a shared component, a route file or a design-system wrapper.
---

# Frontend

The structural rules — domain partitioning, the `boundaries` policy, `@mantine/*`
being private to `shared/design-system`, literal route ids — are in `AGENT.md`
and enforced by Oxlint. This skill covers what the linter cannot check. What
the UI is built from — Mantine through `shared/design-system` wrappers, a design
approved before anything new, then `/design-sync` — is the
`design-system` skill.

## How to work

Follow the `karpathy-guidelines` skill: surface assumptions before coding,
write the least code that does the job, keep every change traceable to the
request, and loop until a check passes — here, a render-to-markup test (see
[Checking it](#checking-it)) and `bun run ci`.

## Style via Mantine props, then CSS

A change to how something looks or sits — position, size, spacing, what
sticks, what truncates, what shows at which width — is made, in this order:

1. **Mantine props** that resolve against the theme: `gap="sm"`, `c="dimmed"`,
   `miw={0}`, `visibleFrom="lg"`, `truncate`, a component's own variant or
   size props.
2. **CSS** in a module, for what props cannot express, reading Mantine's CSS
   variables: hover and focus states, `light-dark()`, and the layout tools CSS
   already has (`position: sticky`, flex and grid, `min-width: 0`, container
   queries).

Exhaust both before reaching for TypeScript.

When CSS seems not to work, look for why before leaving it. The usual
culprits here: a Mantine rule of equal specificity winning (name the class
with its parent, `.split .splitThumb`, as `design-system` wrappers do), a
flex item that will not shrink (`min-width: 0`) or will (`flex: none`), a
`<button>` sizing to its content even as a block (`width: 100%`), an
ancestor whose `overflow` breaks `sticky`. Check the computed style in a
browser rather than guess.

If CSS truly cannot do it — the layout needs a number only script can know,
such as where an element sits on screen — **stop and ask the developer**
whether they want a TypeScript solution, before writing one. Put the
trade-off in front of them, in this case's terms:

| CSS                                                                                                 | A hook or other script (`useElementSize`, a `ResizeObserver`, measuring in an effect)                                                                         |
| --------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Laid out before the first paint, in the browser's own layout pass: no flash, no lag while resizing. | Runs after layout: the first frame can show the wrong state, and every resize or scroll it follows costs a re-render.                                         |
| Holds in every render — server markup, tests, a disabled script — with nothing to clean up.         | Absent in `renderToStaticMarkup` and tests (`bun run` reads CSS modules as `{}` too), and needs listeners and observers set up and torn down without leaking. |
| Lives with the rest of the look, where a designer and `/design-sync` see it.                        | Splits one visual rule between a stylesheet and a component, and adds React state the component did not otherwise need.                                       |
| Bounded by what CSS knows: it cannot read positions or sizes from elsewhere on the page.            | Can do exactly what was asked — e.g. centre on the window rather than on the scrolling panel.                                                                 |

Often the honest answer is a near miss in CSS (centred on the visible panel
rather than the window) against the exact result in script. Offer both and
let the developer choose; do not ship a hook they did not ask for.

### A new CSS variable goes through Mantine

CSS reads Mantine's variables (`var(--mantine-color-…)`, `--mantine-spacing-…`)
rather than literal values. When a value the CSS needs has no variable yet — a
colour or size used in more than one place, or one that differs between light
and dark — do not declare it on `:root` in a stylesheet or set it from a
component. Add it the way Mantine defines its own, with a
[CSS variables resolver](https://mantine.dev/styles/css-variables/#css-variables-resolver):

- Write the resolver in `src/shared/design-system/theme.ts`, beside the theme
  (it is the one place `@mantine/core` may be imported for it), typed
  `CSSVariablesResolver`, returning `variables` for both schemes and `light` /
  `dark` for the ones that differ. Read its values from the theme
  (`theme.colors`, `theme.other`) rather than repeating hex codes.
- Pass it to `MantineProvider` in `src/main.tsx` as `cssVariablesResolver`,
  next to `theme`.
- Name it `--noesis-…` (Mantine keeps `--mantine-…` for itself), after what it
  is for, not what it looks like: `--noesis-page-background`, not
  `--noesis-gray-0`.
- Declare it in [`server/frontend/web-types.json`](../../../server/frontend/web-types.json)
  under `contributions.css.properties`, with a `name` and a `description`
  that says what it is for and where its value comes from, as the brand
  entries there do. That is what lets the IDE complete it and stop flagging it
  as unknown in a CSS module.

## Folding content uses `Collapse`

Anything the reader can fold away and open again in place — a rule's
description, the shortcut legend — slides shut in `Collapse` from
`src/shared/design-system/collapse.tsx`, never `{open && …}` or a class that
hides it. The toggle says what it does and points at what it folds:

```tsx
const body = useId();
<ActionIcon
  aria-label={open ? 'Collapse the details' : 'Expand the details'}
  aria-expanded={open}
  aria-controls={body}
  onClick={() => setOpen(!open)}
>…</ActionIcon>
<Collapse id={body} expanded={open}>…</Collapse>
```

What stays in view when folded (a heading, the toggle itself) sits outside
the `Collapse`. Shut, `Collapse` leaves what it holds out of the page
(React's `Activity`), so a render-to-markup test sees none of it; a short
list that should still be in the page, only not shown — the architecture
legend — passes `keepMountedMode="display-none"`.

Content that is there or not for another reason — no data, no permission —
is still rendered conditionally; `Collapse` is for the reader's own open and
shut.

Two exceptions:

- The model tree: an ARIA tree renders only its expanded subtrees
  (`tree-item.tsx`), as mounting every folded one would mount the whole
  model.
- A floating panel minimized into a button — a canvas's details, see below —
  is not folded but shrunk: the panel scales into its corner with a CSS
  `transform` and fades as the button comes up there, both always rendered
  and swapped by a `data-` attribute, the hidden one `inert`. Scaled whole,
  nothing in it reflows on the way.

## Every canvas reads its selection in a `DetailsDock`

A diagram on a React Flow canvas — the design document's architecture, the
system model's exploration, and any diagram added later — shows what is
selected in a panel over the canvas's top right, and that panel can always
be minimized. Build it from `DetailsDock`
([`src/features/design-docs/ui/architecture/details-dock.tsx`](../../../server/frontend/src/features/design-docs/ui/architecture/details-dock.tsx),
exported to other features through `#/features/design-docs/element-reader.ts`),
never a bare `<Panel>` of its own:

```tsx
const [folded, setFolded] = useState(false); // kept as the selection changes
…
<ReactFlow …>
  {selected !== null && (
    <DetailsDock folded={folded} onUnfold={() => setFolded(false)} subject={name}>
      <DetailsPanel … onMinimize={() => setFolded(true)}>…</DetailsPanel>
    </DetailsDock>
  )}
</ReactFlow>
```

The panel inside is a `DetailsPanel` (or `ElementPanel` / `ArchitectureDetails`,
which wrap it) given `onMinimize` — that is what puts the minimize button in its
header. The dock supplies the rest: the 360px panel with its own scroll
(`nowheel nopan`), the corner button it shrinks into, named "Show the details
of …", and the animation between the two. The folded state lives with the
canvas's selection, outside the dock, so it survives one selection giving way
to the next.

What the panel says is built from the model's own section pieces, whatever is
selected — an element, a check, a need, a placeholder: a part under a title is
the model's `DetailSection` (`element-details/body/sections/detail-section.tsx`,
with `count` and, in the panel, `order={3}`), the elements something is about
are an `ElementRelations` box (`ElementLinks` builds one), a statement is plain
`DetailText` under the header, and a word on why something is empty is a
`NoteSection`. No section titles, link chips or spacing of the canvas's own.

## The diagrams behave and look alike

The system model's exploration and the design document's architecture — and
any diagram added later, such as the mermaid flowcharts, state, class and ER
diagrams drawn on React Flow (`src/shared/ui/mermaid-canvas/`) — are one kind
of canvas to the reader, so they stay in sync in general behaviour, look and
feel. The exploration is the
reference: a change to how one diagram behaves or looks is made to the other
in the same change, or the PR says why it is not.

- **Selection.** A click on a card selects it; a click on the empty canvas
  (`onPaneClick`) or Escape lets go of it. The details panel has a minimize
  button and no close button: it closes as the selection is let go of.
  Escape is heard on its way down (`addEventListener('keydown', …, true)`),
  since a card's tooltip stops it on its way back, and is left alone in a
  field, a tree, a dialog or a menu.
- **Focus.** While something is selected, what has nothing to do with it —
  not the selection, not what it relates to, not a frame round either —
  steps back to `--noesis-diagram-dimmed`, its lines to
  `--noesis-diagram-edge-dimmed`.
- **Shapes.** A card's shape is `shapeOf` in
  [`src/shared/ui/diagram-shapes.tsx`](../../../server/frontend/src/shared/ui/diagram-shapes.tsx):
  a behavior a pill, a value object bevelled, the rest a rounded box, with
  the one selected ring and dashed related ring. Give the card
  `cardShapeClass` and `data-shape`, never a radius, ring or bevel of its
  own; a diagram sets only its fill and edge (`--shape-fill`,
  `--shape-edge`), border style and padding.
- **Colours, sizes, motion.** Every value is a `--noesis-diagram-*` token in
  `cssVariablesResolver` (`src/shared/design-system/theme.ts`), for both
  schemes: surfaces, accent, edges (each relation's line, word, dash and
  speed in `relationEdges`), shapes (`DIAGRAM_SHAPE`) and the dimmed
  opacities. A diagram's stylesheet names tokens, never a literal colour or
  a `light-dark()` of its own; a new one is declared in `web-types.json`.
- **Chrome.** The toolbar is a `CanvasToolbar` with `ZoomControls quiet`,
  the legend a `CanvasLegend` (both `src/shared/ui/`), and the selection is
  read in a `DetailsDock` (above).

## Every modal uses `ModalFrame`

A dialog is built from `ModalFrame`, `ModalBody` and `ModalFooter` in
[`src/shared/ui/modal-frame.tsx`](../../../server/frontend/src/shared/ui/modal-frame.tsx),
never a bare `Modal` with a `title` string. Every modal then reads the same, top
to bottom:

1. **Header**, one line, centred on each other: a 44px light `ThemeIcon` tile
   for what the modal is about or does (the unit's `KindIcon`, a trash in red
   for a removal), the title in bold at `h3` size, the close button. A badge
   (e.g. `ChangeBadge`) may sit after the title. A bottom border.
2. **`ModalBody`**: the content, 20px between fields. The order of fields
   puts the one the user names first (Name before Belongs to).
3. **`ModalFooter`** (only when the modal acts): grey, a top border, a dimmed
   `xs` note on the left saying what is still needed ("A name is required." /
   "Ready to add."), and the buttons on the right — Cancel first, then the
   action, red for a destructive one, `+` before an Add. The action stays
   disabled until the form can be sent.

Spacing: every part has the same padding on all four sides
(`--mantine-spacing-lg`), so the header, the fields and the footer line up. The modal is
620px wide, `radius="lg"`, `shadow="xl"`, centred, and stays open while a save
is on its way (`busy`).

No breadcrumb: the page behind the modal already says where its subject sits.

Accessibility: the dialog is named by its title alone. A badge beside the
title is `aria-hidden` — it repeats what the page already says.

A full-screen canvas (the diagram viewer) is not a dialog of this kind; it
keeps `Modal` with `fullScreen`, its title in the same bold `h3` type.

## Accessibility

**Follow WCAG 2.2 level AA wherever it applies.** The UI is a reading tool: it
is mostly headings, links and prose, so the applicable success criteria are few
and concrete. Do not add ARIA to work around markup that is wrong — fix the
markup. `jsx-a11y` runs in Oxlint; a rule it reports is a defect, not noise, and
a disable needs a comment saying why (`sidebar.tsx` has the only one).

### Headings carry the outline (1.3.1, 2.4.6)

Levels nest and never skip, and every page has exactly one `h1`. That `h1` is
`IconHeading`: the view's name on a list page, the item's name on a detail
page. So:

| Where                                     | Level         |
| ----------------------------------------- | ------------- |
| `ViewHeader` / the item on a detail view  | `h1`          |
| a card in a list, a section of a document | `h2`          |
| below that                                | `h3`, `h4`, … |

A view that renders nothing else — `/system-model`, the not-found views —
still needs its heading, so its route wraps with `withViewHeader`.

`order` sets the tag; `size` sets the type scale. Use `size` to keep the design
when a level moves: `<Title order={1} size="h2">` is the page heading, semantic
`h1`, styled as the app's `h2`.

Markdown from the graph is authored as its own document, starting at `#`.
`Markdown` shifts every level so the document nests under the page heading
(`headingLevel`, `2` by default) — never render it unshifted, or a document's
`#` opens a second `h1` beside the page's own.

### Icons are decorative (1.1.1)

An icon beside a label repeats it. Hide it: `aria-hidden` on the icon or on the
wrapper that holds it, as `IconHeading` does. An icon that is the _only_ content
of a control needs a name instead — `aria-label` on the control.

### A picture that carries meaning needs a name (1.1.1)

A mermaid diagram renders to an SVG with no accessible name of its own.
`MermaidDiagram` gives its wrapper `role="img"` and a name, preferring the
author's `accTitle:` line over the diagram kind. When writing a diagram into a
document, write `accTitle:` — it is the only text a screen reader can read in
place of the picture.

### One link per card, and the whole card (2.4.7, 2.5.8)

A list card is a single `<a>` (`CardLink`), not a card containing a link: it
gives the target the full hit area and one tab stop. Never nest an interactive
element inside another. Anything styled for `:hover` also gets `:focus-visible`
with a visible outline — keyboard users get the same affordance as the mouse.

### State is never colour alone (1.4.1, 1.4.3)

A badge, a status or a diff marker carries a word as well as a colour — the
design document's `added` / `modified` / `removed` badges are the pattern.
Colours come from Mantine tokens so they hold in both schemes; check any custom
value in light **and** dark.

### Pending and failed states announce themselves (4.1.3)

A loading line is `<Text component="output">`, which is a live region. Mantine's
`Alert` already carries `role="alert"`, so an error in one is announced — do not
add a second role.

## Checking it

There is no browser here. Render the real thing to static markup and assert on
it, the way `test/markdown.spec.tsx` and `test/icon-heading.spec.tsx` do:

```tsx
const html = renderToStaticMarkup(
  <MantineProvider><TheComponent … /></MantineProvider>,
);
expect(html).toMatch(/<h3[^>]*>Payment retry policy<\/h3>/);
```

For a whole page, drive the real router with `createMemoryHistory`, `await
router.load()`, and a stubbed `fetch`; then read the heading tags out in
document order. That is how the heading levels above were found to be wrong.

Note that `bun run` outside vite resolves `*.module.css` to `{}`, so a CSS
module class is absent from probe output. Check styling through `bun run
build:spa` and the emitted CSS instead.
