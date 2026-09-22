---
name: frontend
description: Conventions for the Noesis SPA in server/frontend, and the accessibility rules its components must meet. Use when adding or changing anything under server/frontend/src — a view, a shared component, a route file or a design-system wrapper.
---

# Frontend

The structural rules — domain partitioning, the `boundaries` policy, `@mantine/*`
being private to `shared/design-system`, literal route ids — are in `AGENT.md`
and enforced by Oxlint. This skill covers what the linter cannot check.

## Accessibility

**Follow WCAG 2.2 level AA wherever it applies.** The UI is a reading tool: it
is mostly headings, links and prose, so the applicable success criteria are few
and concrete. Do not add ARIA to work around markup that is wrong — fix the
markup. `jsx-a11y` runs in Oxlint; a rule it reports is a defect, not noise, and
a disable needs a comment saying why (`sidebar.tsx` has the only one).

### Headings carry the outline (1.3.1, 2.4.6)

Levels nest and never skip. The shell gives every page one heading through
`IconHeading` at `order={2}`, so:

| Where                                     | Level         |
| ----------------------------------------- | ------------- |
| `ViewHeader` / the item on a detail view  | `h2`          |
| a card in a list, a section of a document | `h3`          |
| below that                                | `h4`, `h5`, … |

Markdown from the graph is authored as its own document, starting at `#`.
`Markdown` shifts every level so the document nests under the page heading
(`headingLevel`, `3` by default) — never render it unshifted, or a document's
`#` opens a second outline above the page's own heading.

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
