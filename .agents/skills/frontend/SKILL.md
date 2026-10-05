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

| CSS                                                                                                    | A hook or other script (`useElementSize`, a `ResizeObserver`, measuring in an effect)                                                                                |
| ------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Laid out before the first paint, in the browser's own layout pass: no flash, no lag while resizing.     | Runs after layout: the first frame can show the wrong state, and every resize or scroll it follows costs a re-render.                                              |
| Holds in every render — server markup, tests, a disabled script — with nothing to clean up.             | Absent in `renderToStaticMarkup` and tests (`bun run` reads CSS modules as `{}` too), and needs listeners and observers set up and torn down without leaking.        |
| Lives with the rest of the look, where a designer and `/design-sync` see it.                            | Splits one visual rule between a stylesheet and a component, and adds React state the component did not otherwise need.                                             |
| Bounded by what CSS knows: it cannot read positions or sizes from elsewhere on the page.               | Can do exactly what was asked — e.g. centre on the window rather than on the scrolling panel.                                                                        |

Often the honest answer is a near miss in CSS (centred on the visible panel
rather than the window) against the exact result in script. Offer both and
let the developer choose; do not ship a hook they did not ask for.

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
