# Plan: the architecture view of a design document

A design document is read today as a model and as requirements. This plan
adds a third view, Architecture, that reads the same document on the
assumption that the designed system has a clean, hexagonal architecture: each
module that holds building blocks is a hexagon, its application services'
public behaviours are its driving ports, and its repositories and external
integrations are its driven ports. The view draws the hexagons and checks the
design against the dependency rule, so a reviewer sees where the design keeps
to the architecture, where it leaves it, and what it leaves undecided.

Builds on `design-doc-requirements-view.md`: the view switch, the two
columns and the tree the requirements view reads through. The prototype is
`design-doc-architecture-view.prototype.html`, drawn from the
`examples/qdoc-java` design doc `2026-10-02-create-a-qdoc`.

## Decisions

| Topic         | Decision                                                                                                                                                                                                       |
| ------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| What it shows | One design document, read-only, projected by the frontend from the design document. Nothing is stored for it                                                                                                   |
| Hexagon       | A module that holds building blocks. The modules above it are the system boundary and are not drawn as hexagons                                                                                                |
| Rings         | By building block type. Domain core: `aggregate`, `entity`, `value_object`, `domain_service`, `factory`. Application: `application_service`. Driven port: `repository`, `external_integration`                 |
| Driving port  | A public behaviour of an application service. The actors in its visibility drive it; a public behaviour with no actors is called by another subsystem, which the view draws as an unknown caller               |
| Adapters      | Not in the design document. Every driving port gets an in adapter and every driven port an out adapter, drawn as placeholders marked "not designed"                                                            |
| Edges         | Only what the document holds: actor to in adapter, in adapter to driving port, a port to the service that owns it, out adapter to driven port. Calls between services and driven ports are not in the document |
| Flow by type  | A behaviour's output type that another behaviour takes as input is listed in the details as an inferred flow, marked "type match only" where the match is not a real flow. It is never drawn as an edge        |
| Checks        | Computed from building block types, visibility and the types properties, inputs and outputs use. Each is a warning, a note or a pass, and names the elements it concerns                                       |
| Needs         | Each need, and the driving ports whose behaviour's rules answer it. A need no port answers says so                                                                                                             |
| Tree          | The left pane is the pane the other views use: search, expand and collapse, rows with rails. Two groups: Checks, and Needs at the ports                                                                        |
| Details       | Below the rows, in the tree pane, scrolling apart from them. The diagram stays whole                                                                                                                           |
| Diagram       | The right pane. One hexagon per module, drawn by React Flow with a band layout of our own                                                                                                                      |
| Selection     | One selection for both panes. A row selects its element, check or need; a card selects its element and opens the tree to its row. The elements a selection concerns are outlined                               |
| Overlays      | Check markers on the cards (on by default) and rule counts (off by default), toggled in the diagram's toolbar                                                                                                  |
| Switching     | `view: 'architecture'` on the design document route. The place is kept under names of its own, `arch` and `archQ`, as the requirements view keeps `entry` and `entryQ`                                         |
| Changes       | A green-field design is drawn whole. In a brownfield one, an element whose type the design leaves unchanged cannot be placed from the document alone; see Data gap                                             |

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
  selection and its own layout. It stays for the behaviours' sequence diagrams
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

| Check                                | Level   | Fails when                                                                                                      |
| ------------------------------------ | ------- | --------------------------------------------------------------------------------------------------------------- |
| Domain depends on no port            | Warning | A domain block's property, input or output uses a repository, an external integration or an application service |
| Only application services are public | Warning | A behaviour of any other building block is public: the core is exposed past its ports                           |
| No type crosses hexagons             | Warning | A property, input or output in one hexagon uses a type of another                                               |
| Type in no contract                  | Warning | A building block is used by no property, input or output                                                        |
| Caller unknown                       | Note    | A public behaviour names no actor                                                                               |

A check that finds nothing is a pass and lists the elements it checked. On
the qdoc design the first three pass, `NewQDocNotification` is in no contract (only `createQDoc`'s sequence diagram
names it), and `notifyUsers`' caller is unknown.

There is no check that a port's adapter is decided. A port is the hexagon's
own contract and carries no technology; what sits behind it — a database, a
broker, a REST endpoint — is the adapter's to say, and the design document
has no adapters. The placeholders marked "not designed" show the gap.

## Model (`server/frontend/src/features/design-docs/`)

`design-doc-architecture.ts`, a pure function from a design document (and,
later, the system model) to what the view renders, tested without React:

```ts
interface ArchitectureOutline {
  hexagons: Hexagon[];
  /** Elements the view cannot place: a type neither changed nor known. */
  unplaced: PlacedElement[];
  checks: ArchitectureCheck[];
  needsAtPorts: { need: DesignedNeed; ports: BehaviorId[] }[];
}

interface Hexagon {
  module: { id: ModuleId; name: string };
  drivingPorts: {
    behaviour: PlacedElement;
    actors: string[]; // empty: called by another subsystem
  }[];
  applicationServices: PlacedElement[];
  domainCore: PlacedElement[];
  drivenPorts: PlacedElement[];
}

interface PlacedElement {
  id: BuildingBlockId | BehaviorId;
  name: string;
  pattern: string; // building block type or behaviour type
  change: OutlineChange;
  /** The building blocks its properties, inputs and outputs use, collections unwrapped. */
  uses: BuildingBlockId[];
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
lists, for one element, the behaviours that give it or take from it a type,
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
   rings, driving ports and their actors, a public behaviour with no actors,
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

- Calls. The design document has no call edges, so the view cannot draw which
  service uses which port, or a call from one hexagon to another
  (`createQDoc` to `notifyUsers`). A `calls` field on behaviours would add
  both, and a check that the domain calls no port.
- Adapters as building blocks. A placeholder is drawn for each port until the
  design document can say what sits there.
- Editing the design from the diagram.

## Open questions

- Whether a `calls` field on behaviours belongs in the design document, or the
  calls stay in the sequence diagrams.
- Whether events need a building block type of their own. The prototype tells
  `QDocCreated` apart only by its definition starting "Event:".
- Whether the system model travels with the design document or by a route of
  its own.
