# Plan: the architecture view of a design document

A design document is read today as a model and as requirements. This plan
adds a third view, Architecture, that reads the same document on the
assumption that the designed system has a clean, hexagonal architecture: each
module that holds building blocks is a hexagon, the behaviors of its
application services and in adapters are its driving ports, and its
repositories, external integrations, out adapters and technical services are
its driven ports. The view draws the hexagons and checks the
design against the dependency rule, so a reviewer sees where the design keeps
to the architecture, where it leaves it, and what it leaves undecided.

Builds on `design-doc-requirements-view.md`: the view switch, the two
columns and the tree the requirements view reads through. The prototype is
`design-doc-architecture-view.prototype.html`, drawn from the
`examples/qdoc-java` design doc `2026-10-02-create-a-qdoc`.

Built. Placement and checks follow the new system model
([`new-system-model.md`](new-system-model.md), steps 3 and 4): the building
block kinds, no visibility, and who calls a behavior read from the
`invokes` and `performs` relations. The sections below say what is built;
the steps keep the order it was built in.

## Decisions

| Topic         | Decision                                                                                                                                                                                                                                                                                                           |
| ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| What it shows | One design document, read-only, projected by the frontend from the design document. Nothing is stored for it                                                                                                                                                                                                       |
| Hexagon       | A module that holds building blocks. The modules above it are the system boundary and are not drawn as hexagons                                                                                                                                                                                                    |
| Rings         | By building block type. Domain core: `aggregate`, `entity`, `domain_service`, `factory`, `value_object`, and the messages the ports carry, `command`, `query`, `event`. Application: `application_service` and `in_adapter`. Driven port: `repository`, `external_integration`, `out_adapter`, `technical_service` |
| Driving port  | Every behavior of an application service or an in adapter. Its actors perform the manual processes that invoke it, directly or through an in adapter's behavior. A port no manual process and no in adapter invokes is called by another subsystem, which the view draws as an unknown caller                      |
| Adapters      | An in adapter the design holds is placed with the application services, an out adapter with the driven ports. Every driving port still gets an in adapter and every driven port an out adapter, drawn as placeholders marked "not designed"                                                                        |
| Edges         | Actor or unknown caller to in adapter, in adapter to driving port, a port to the service that owns it, driven port to out adapter. The `invokes` relations are read for the actors, the unknown callers and the exposed band, never drawn                                                                          |
| Flow by type  | A behavior's output type that another behavior takes as input is listed in the details as an inferred flow, marked "type match only" when the taker is in another hexagon and is no driving port. It is never drawn as an edge                                                                                     |
| Checks        | Computed from building block types, the `invokes` and `performs` relations, and the types state, collaborators, inputs and outputs use. Each is a warning, a note or a pass, and names the elements it concerns                                                                                                    |
| Needs         | Each need, and the driving ports whose behavior's rules answer it. A need no port answers says so                                                                                                                                                                                                                  |
| Tree          | The left pane is the pane the other views use: search, expand and collapse, rows with rails. Two groups: Checks, and Needs at the ports                                                                                                                                                                            |
| Details       | Below the rows, in the tree pane, scrolling apart from them. The diagram stays whole                                                                                                                                                                                                                               |
| Diagram       | The right pane. One hexagon per module, drawn by React Flow with a band layout of our own                                                                                                                                                                                                                          |
| Selection     | One selection for both panes. A row selects its element, check or need; a card selects its element and opens the tree to its row. The elements a selection concerns are outlined                                                                                                                                   |
| Overlays      | Check markers on the cards (on by default) and rule counts (off by default), toggled in the diagram's toolbar                                                                                                                                                                                                      |
| Switching     | `view: 'architecture'` on the design document route. The place is kept under names of its own, `arch` and `archQ`, as the requirements view keeps `entry` and `entryQ`                                                                                                                                             |
| Exposed       | A behavior of a block that is no application service and no in adapter, which a manual process or a behavior of another module invokes: the core reached past its ports. Shown on its block's card, not as a card of its own                                                                                       |
| Changes       | A green-field design is drawn whole. In a brownfield one, an element whose type the design leaves unchanged cannot be placed from the document alone; see Data gap                                                                                                                                                 |

## Library

React Flow (`@xyflow/react` v12), MIT.

- Its nodes are React components, so a card is built from the design-system
  wrappers, the tabler icons and the change badge, and the diagram looks like
  the rest of the app in both colour schemes.
- It has what the view needs without building it: controlled selection, pan,
  zoom, fit to view, zoom controls, keyboard-focusable nodes.
- Parent nodes carry the hexagon and the domain core, drawn as an SVG polygon,
  with the cards placed inside them.

The layout is ours, not a layout engine's. Every hexagon has the same bands —
actors, in adapters, driving ports, application services, domain core, driven
ports, out adapters — so `layoutArchitecture` places them deterministically
and is tested as a pure function. `elkjs` (EPL-2.0) is the fallback if domain
cores grow past what a grid holds.

Considered and left out:

- Mermaid, already a dependency: a static SVG with no hexagon, no controlled
  selection and its own layout. It stays for the behaviors' sequence diagrams
  in the details.
- LikeC4: C4 notation, its own model language and its own styling; it is
  built on React Flow itself.
- Cytoscape.js: draws on a canvas, so a card cannot be a React component and
  the diagram is opaque to assistive technology.
- D3, JointJS: low level; every interaction would be ours to write.

## Layout

```
# <design doc name>                       [Model | Requirements | Architecture] [⛶]

┌ tree pane ───────────────────┐ ┌ diagram pane ─────────────────────────────────┐
│ [search]           [⇕] [⇳]   │ │ legend · ☑ check markers · ☐ rule counts · ±  │
├──────────────────────────────┤ ├───────────────────────────────────────────────┤
│ ▾ Checks                     │ │  <module>               <module>              │
│   ▾ ⚠ <warning>          n   │ │   actor                   caller              │
│       <element>              │ │   in adapter              in adapter          │
│   ▸ ✓ <pass>                 │ │  ⬡ driving port ───────  ⬡ driving port       │
│ ▾ Needs at the ports         │ │    application service     application service│
│   ▾ ◎ <need>                 │ │    ⬡ domain core           ⬡ domain core      │
│       <driving port>         │ │    driven ports            driven port        │
├──────────────────────────────┤ │   out adapters            out adapter         │
│ <kind>                    ×  │ │                                               │
│ <title> · <id>               │ │                                               │
│ definition, checks, contract,│ │                                               │
│ speaks in, flow, rules,      │ │                                               │
│ sequence diagram             │ │                                               │
└──────────────────────────────┘ └───────────────────────────────────────────────┘
```

## Checks

| Check                                                             | Level   | Fails when                                                                                                             |
| ----------------------------------------------------------------- | ------- | ---------------------------------------------------------------------------------------------------------------------- |
| Domain depends on no port                                         | Warning | A domain core block's state, collaborator, input or output uses a driven port, an application service or an in adapter |
| Only application services and in adapters are called from outside | Warning | A behavior is in the exposed band: a manual process or another module invokes a behavior of another kind of block      |
| Type in no contract                                               | Warning | An aggregate, entity, value object, command, query or event is used by no state, collaborator, input or output         |
| Caller unknown                                                    | Note    | A driving port is invoked by no manual process and no in adapter                                                       |

A check that finds nothing is a pass and lists the elements it checked. On
the qdoc design the first two pass, `NewQDocNotification` is in no contract (only `createQDoc`'s sequence diagram
names it), and `notifyUsers`' caller is unknown: the manual process _Create a QDoc_ invokes
`createQDoc` only.

There is no check that a port's adapter is decided. A port is the hexagon's
own contract and carries no technology; what sits behind it — a database, a
broker, a REST endpoint — is the adapter's to say. A design may hold in and
out adapters as building blocks, but the view does not tie one to the port
it serves; the placeholders marked "not designed" show the gap.

## Model (`server/frontend/src/features/design-docs/`)

`design-doc-architecture.ts`, a pure function from a design document (and,
later, the system model) to what the view renders, tested without React. The
shapes are in `architecture-outline.ts`:

```ts
interface ArchitectureOutline {
  hexagons: Hexagon[];
  /** Elements the view cannot place: a type the design neither sets nor knows. */
  unplaced: PlacedElement[];
  checks: ArchitectureCheck[];
  needsAtPorts: { need: DesignedNeedInput; ports: BehaviorId[] }[];
}

interface Hexagon {
  module: { id: ModuleId; name: string };
  drivingPorts: {
    behavior: PlacedBehavior;
    service: BuildingBlockId; // the application service or in adapter it is on
    actors: string[]; // who performs the manual processes that invoke it
    callerKnown: boolean; // false: no manual process and no in adapter invokes it
  }[];
  applicationServices: PlacedBlock[]; // application services and in adapters
  domainCore: PlacedBlock[];
  drivenPorts: PlacedBlock[];
  /** Behaviors of other blocks a manual process or another module invokes. */
  exposed: PlacedBehavior[];
}

interface PlacedElement {
  id: BuildingBlockId | BehaviorId;
  name: string;
  pattern: BuildingBlockType | null; // a behavior has none
  change: OutlineChange;
  /** The building blocks its state, collaborators, inputs and outputs use; itself left out. */
  uses: BuildingBlockId[];
  /** The rules it governs, and for a block those its behaviors govern. */
  rules: PlacedRule[];
}

interface ArchitectureCheck {
  id: string;
  level: 'warning' | 'note' | 'pass';
  title: string;
  text: string;
  elementIds: string[];
}
```

`architecture-checks.ts` holds one pure function per check, each taking the
outline's hexagons and answering an `ArchitectureCheck`. `inferredFlowOf`
lists, for one element, the behaviors that give it or take from it a type,
marking a match the design contradicts.

`architectureTreeOf` projects checks and needs into `OutlineNode`s, so the
tree is the shared model tree. `OutlineKind` gains `check`; `KindIcon` gains
the warning, note and pass patterns.

## UI (`server/frontend/src/features/design-docs/ui/`)

- `view-switch.tsx`, `design-docs.model.ts`: the third view and its `arch`,
  `archQ` search params.
- `columns.tsx`: an optional slot below the rows, scrolling apart from them,
  for the details.
- `architecture-view.tsx`: the columns, the shared search box and tree, the
  details, the diagram; the one selection both panes read.
- `architecture-details.tsx`: an element reuses the model view's
  `ElementDetail` body sections; a check or a need gets a short body of its
  own that links to its elements.
- `architecture-diagram.tsx`: React Flow with node types `hexagon`,
  `domainCore`, `actor`, `adapter`, `port`, `element`; the toolbar with the
  overlays and the zoom.
- `layout-architecture.ts`: the band layout, pure.

All of it follows the `frontend` skill: design-system wrappers, colours from
Mantine variables in both schemes, an `aria-label` on every node, the tree as
the way through the view by keyboard, the panes stacked on a phone.

## Data gap

The design document route answers the document alone, and a modified element
carries only the fields it changes. An element whose type the design leaves
alone cannot be placed in a ring, and the elements the design does not touch
are not in it at all. Until the view loads the newest system model beside the
document, such elements are listed as unplaced, and the view says so. With the
system model, unchanged elements are drawn faded and a modified one takes its
type from the model.

## Steps

1. `design-doc-architecture.ts` and `architecture-checks.ts` with specs: the
   rings, driving ports and their actors, a public behavior with no actors,
   type references through collections, every check passing and failing, the
   needs at the ports, an unplaced element. A fixture drawn from the qdoc
   design gives the findings above.
2. The third view, its search params and the tree, with the details below the
   rows; a spec that the address keeps the view and its place. The view is
   useful from here, as a list of checks.
3. `layout-architecture.ts` with specs, then `architecture-diagram.tsx`: the
   hexagons, the edges, the selection shared with the tree, the overlays, the
   zoom, fit to view on opening.
4. The newest system model beside the document: unchanged elements faded,
   modified ones placed by their scanned type, nothing left unplaced on a
   scanned system.
5. Check the view of `examples/qdoc-java` `2026-10-02-create-a-qdoc` against
   the prototype.
6. Run lint, tests and knip.

## Not in this plan

- Drawing calls. The design document holds `invokes` relations now, but the
  view reads them only for who drives a port and for the exposed band; it does
  not draw which service uses which port, or a call from one hexagon to
  another (`createQDoc` to `notifyUsers`), and has no check that the domain
  calls no port.
- Adapters at their ports. In and out adapters are building block kinds, but
  nothing says which port an adapter serves, so a placeholder is drawn for
  each port.
- Editing the design from the diagram.

## Open questions

- Whether a `calls` field on behaviors belongs in the design document.
  _Settled_: the new system model's `invokes` relations, which a design
  writes too.
- Whether events need a building block type of their own. _Settled_: `event`,
  `command` and `query` are building block kinds, placed in the domain core.
- Whether the system model travels with the design document or by a route of
  its own.
