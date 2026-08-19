# Design document workspace — prototype

[`document-view.html`](document-view.html) is the agreed direction: the specification read and
edited as **one document**, not browsed as a catalogue or a map. It is the reference for the
implementation plan in [`../plan.md`](../plan.md).

Open the file directly, or serve the folder:

```bash
python3 -m http.server 8777 --directory docs/work/features/design-doc/prototypes
```

| File                 | Contents                                                                                                                                                                                                 |
| -------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `document-view.html` | The prototype: document, table of contents, editor chrome, comments, suggestions, agent chat. No build step, no dependencies, no network calls.                                                          |
| `sample-data.js`     | The sample design document it renders: appointment booking, 2 bounded contexts, 4 application services, 8 use cases, 4 actors, 22 building blocks, comments, suggestions and one pending agent proposal. |

The earlier concepts — the Stage 1 side-panel / preview / zoomable-canvas comparison, and the
original sketches — live in [`../prior-art/`](../prior-art/README.md).

## What the prototype demonstrates

**Document shape.** Goal, business context, target outcomes and scope open the document; actors
follow; then the use cases, grouped bounded context → application service, each with summary,
description, rules, input, output, acceptance scenarios and quality attributes in the fixed order
from decision 49. The left rail is the numbered table of contents, three levels deep, with
scroll-spy. Empty sections are not printed as empty boxes — they are named once, quietly, at the end
of the use case, so a thin Draft still reads as a document.

**Every block is bound to a schema element.** The binding is shown inline (`Schema bindings` in the
top bar): `designDocument.goal`, `useCase[uc-book-appointment].rules[]`,
`acceptanceScenario[sc-book-happy]`. There is no free-floating prose — the slash menu offers only
what the schema allows at that point, dragging reorders a block only inside its own schema array,
and ordered lists renumber from their new position.

**BlockNote-style editing**, matching the library the implementation will use: a hover gutter with
a pen (✎) and a drag handle on every block, and a formatting toolbar on selection. The pen — or `/`
inside a block — opens the one block menu: the typed elements insertable at that point, then the
actions on the block itself (Duplicate, and **Delete** for list members or **Clear** for single
fields; elements the schema requires say so instead). The drag handle only drags. While Suggesting,
a delete is filed as a _suggested removal_: the block stays struck through until it is accepted.

**Three modes**, as in Google Docs: a dropdown switches Editing / Suggesting / Viewing. Viewing is
read-only; Suggesting files edits instead of applying them.

**Suggested changes** — the human review path, never used by the agent. The old wording stays struck
through with the proposed wording underlined
beside it; a card in the right rail carries the author, the `old → new` diff, their reason and
Accept / Reject. Suggestions narrow to the words that actually changed.

**Comments**, in a threads sidebar modelled on BlockNote's `ThreadsSidebar`: select text and choose
**Comment**, commented text is marked in the document, clicking a mark selects its thread and
clicking a thread scrolls to and flashes its block. Threads and suggestions share the rail, sorted
by document position, filtered by Open / Suggestions / Resolved / All, with replies, resolve/reopen
and `@mentions` of people. Comments address people only — there is no agent mention.

**Agent chat — mocked.** The surface is real and the replies are canned: a round launcher in the
bottom-left corner expands into a panel docked along the bottom of the document column, marked
`mock`. Usable with nothing selected; **Ask agent** on marked text sends the quote and its schema
binding in as context. The canned answer names the bound element and offers to **apply** the change:
what the user asks for in chat is applied to the document directly. Agent work nobody asked for — a
new source-code scan, a re-analysis of the model — arrives as a whole-document proposal instead,
which is the pending proposal in the sample. The agent never authors suggestions; Suggesting mode is
the human review path.

**Codebase delta** stays quiet: `+ new`, `± modified`, `− removed` beside a name, Existing unmarked,
never colour alone.

## Prototype limits

Edits, comments, suggestions and chat live in memory and reset on reload. Collaboration is
represented (comments, mentions, authorship) but not live. The agent's replies are canned. Layout
targets 1280 px and wider.
