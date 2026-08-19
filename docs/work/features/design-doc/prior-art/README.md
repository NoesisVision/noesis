# Prior art — superseded prototypes

**Status:** Obsolete. Kept for reference only. The live prototype is
[`../prototypes/document-view.html`](../prototypes/document-view.html); the direction it settles is
written up in [`../plan.md`](../plan.md).

## `stage1/` — the three-concept comparison

Built against the current specification and compared as Stage 1 (section 15 of `../design-doc.md`).
All three share one sample dataset and one component set, so the comparison isolated the navigation
model. Open `stage1/index.html` for the launcher.

| File                                        | Concept                                                                  |
| ------------------------------------------- | ------------------------------------------------------------------------ |
| `stage1/prototype-a-side-panel.html`        | Catalogue and behaviour map beside a persistent document side panel      |
| `stage1/prototype-d-preview-workspace.html` | Compact preview, then an explicit jump into a focused use-case workspace |
| `stage1/prototype-e-zoomable-canvas.html`   | Use case expands in place on a zoomable canvas                           |
| `stage1/shared.css`, `stage1/shared.js`     | The shared component set the three shells rendered with                  |
| `stage1/sample-data.js`                     | Frozen copy of the sample document, so these keep running unchanged      |

**Why superseded:** all three treated the specification as something to _browse_ — a catalogue or a
map, with details opened per element. Review showed the document reads better as one continuous
specification: goal and business context first, then use cases in order. That is the document view.
What carried over: the fixed section order, the codebase-delta markers, the typed field lists, the
threads sidebar, and the sample document itself.

## The original sketches

Three HTML sketches predating the current specification. They target an earlier data model and an
earlier product framing:

- building blocks, not use cases, are the primary browsable objects;
- there is no first-class, independently addressable use case;
- there are no actors as first-class canvas nodes;
- there is no Product/Technical lens switch;
- change state is carried by a single `_change` flag, which collapses the two dimensions the
  specification now separates (codebase-relative design state versus proposal state).

| File                                     | Sketch                                           |
| ---------------------------------------- | ------------------------------------------------ |
| `design-doc-prototype-a-workbench.html`  | Document-plus-list workbench                     |
| `design-doc-prototype-b-canvas.html`     | Building-block canvas grouped by bounded context |
| `design-doc-prototype-c-manuscript.html` | Long-form manuscript reading view                |
