# Plan: what #119 added to the system model, in the frontend

Status: proposed (November 2026).

#119 (`feat(system-model): add artifacts, layers, containers,
collaborators`) extended the contract. The SPA type-checks against that
contract, but it shows none of the additions. This plan brings all of them
into the frontend.

What #119 added:

| Added                                                            | Contract                                       | In the SPA today                                                                               |
| ---------------------------------------------------------------- | ---------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| `has_collaborator`                                               | block → block, a named slot with `cardinality` | dropped by `relation()` in `system-model.model.ts`, and skipped by the explorer                |
| `unit_contains_module`                                           | deployable unit → module                       | dropped and skipped                                                                            |
| `library_contains_block`                                         | library → block                                | dropped and skipped                                                                            |
| `layer_contains_block`                                           | layer → block                                  | dropped and skipped                                                                            |
| `container_contains_unit`                                        | deployment container → deployable unit         | dropped and skipped                                                                            |
| `deployableUnits`, `libraries`, `layers`, `deploymentContainers` | four element lists, none in a module           | not read                                                                                       |
| `in_adapter`, `out_adapter`, `technical_service`                 | building block kinds                           | no icon, no reading order, not offered in the unit editor, not placed in the architecture view |

Scope: `server/frontend` only. Backend, builders, the design-document schema
and the skills are left alone.

Two consequences of keeping to the frontend:

- **No real scan has any of these yet.** No builder writes them. Fixtures
  carry them, and the SPA is ready when a builder lands.
- **The design-document views stay without the new relations and
  elements.** These are the model tree, the element panel, search and the
  architecture diagram, and they read a `DesignDocument`, built from the
  model by `designOf`. `DesignedRelation` and `DesignDocument` (backend
  `design-doc.ts`) hold none of the five relations and none of the four
  element lists, so `relation()` keeps returning `null` for them. The three
  new block kinds are the exception: a designed block's `type` is
  `BuildingBlockKind`, so they reach those views already (section 4).

So the work splits in two:

- **A. The explorer**, which reads the `SystemModel` directly
  (`explorationOf`), shows every new relation and element.
- **B. The three new block kinds** are known wherever the SPA lists block
  kinds.

## 1. Decisions

1. **Four new explored kinds.** `ExploredKind` gains:
   - `deployable_unit`
   - `library`
   - `layer`
   - `deployment_container`

   `explorationOf` reads them from the model's four new lists as cards in
   no module (`container: null`), as actors are. They join `joinable`, so
   relations to and from them are drawn. They get a new section in the
   element filter:

   ```ts
   ['Deployment', ['deployable_unit', 'library', 'deployment_container']],
   ['Layers', ['layer']],
   ```

   `SECTIONS` today maps one title to one kind. It becomes a title to a
   list of kinds, or one row per kind if that reads better in
   `kind-list.tsx`. The design proposal decides which.

2. **The four new containments are drawn as edges, not as nesting.** In
   the explorer, containment is cards inside cards, and an element has one
   container (`containerOf` is a map). A block already sits in its module.
   A layer, a library and a unit cut across modules, and a module can ship
   in several units, so none of them can be a second parent. They become
   drawn relations:

   | kind       | models                    | label    | word     | reach      | back         |
   | ---------- | ------------------------- | -------- | -------- | ---------- | ------------ |
   | `ships`    | `unit_contains_module`    | Ships    | ships    | `ships`    | `shippedIn`  |
   | `provides` | `library_contains_block`  | Provides | provides | `provides` | `providedBy` |
   | `places`   | `layer_contains_block`    | Places   | places   | `places`   | `placedIn`   |
   | `runs`     | `container_contains_unit` | Runs     | runs     | `runs`     | `runsOn`     |

   The words come from the contract's descriptions ("ships a module",
   "provides a building block", "places a building block", "runs a
   deployable unit"). `CONTAINMENT` is unchanged: "Contains" and "Is part
   of" still mean the module tree.

3. **`has_collaborator` is a drawn relation too:**

   | kind           | models             | label        | word       | reach       | back             |
   | -------------- | ------------------ | ------------ | ---------- | ----------- | ---------------- |
   | `collaborator` | `has_collaborator` | Collaborator | works with | `worksWith` | `collaboratorOf` |

   When a block holds the same collaborator under two names, it gets one
   edge, as `pairs` already does for state.

4. **What is shown when the explorer opens.** `collaborator` joins the
   default set in `exploration-view.tsx:190`, beside `state`. `ships`,
   `provides`, `places` and `runs` start hidden: a layer joins every block,
   and on by default it would bury the diagram. Adding a layer or unit card
   from the picker or a card's menu still draws its edges, as the reach
   menu does for any hidden kind. A saved view keeps what it saved.

5. **How it looks** _(proposed; goes through the `design-system` skill's
   proposal step, then `/design-sync`)_. Every value is a token in
   `relationEdges` in `theme.ts`, the one place for diagram looks, and is
   declared in `web-types.json`. The cyberarch theme gets `--edge-<kind>`
   for each.

   Edges:

   | kind           | colour | dash / gap / seconds          | arrow | why                                                                    |
   | -------------- | ------ | ----------------------------- | ----- | ---------------------------------------------------------------------- |
   | `collaborator` | cyan   | 6 / 4 / 0.9                   | open  | a dependency resting, near state but told apart                        |
   | `ships`        | grape  | 2 / 3 / 1.2 (fine dots, slow) | open  | the build's structure: one family, one quiet look                      |
   | `provides`     | grape  | 2 / 3 / 1.2                   | open  | the same family; the word tells it apart                               |
   | `runs`         | grape  | 2 / 3 / 1.2                   | open  | the same family                                                        |
   | `places`       | yellow | 2 / 6 / 1.5                   | open  | a slice of the code, not a build artifact: its own colour, sparse dots |

   Cards: units, libraries and containers are boxes (`shapeOf` needs no
   change). A layer card is a box too. A wide band behind its blocks would
   be nicer, but it needs the layout to know layers, so it is left for
   later.

6. **Icons** (`kind-icon.tsx`, Tabler):

   | kind / pattern         | icon          |
   | ---------------------- | ------------- |
   | `deployable_unit`      | `IconPackage` |
   | `library`              | `IconBooks`   |
   | `layer`                | `IconStack2`  |
   | `deployment_container` | `IconServer`  |
   | `in_adapter`           | `IconLogin2`  |
   | `out_adapter`          | `IconLogout2` |
   | `technical_service`    | `IconTool`    |

   `KIND_ICONS` is typed `Record<OutlineKind, …>`, and the explorer passes
   an `ExploredKind`. The four new kinds are explored but not outlined, so
   `KindIcon` takes `OutlineKind | ExploredKind` and `KIND_ICONS` covers
   both. `OutlineKind` itself does not grow.

7. **The three new block kinds everywhere kinds are listed (part B):**
   - `kind-icon.tsx`: `PATTERNS`, `PATTERN_ICONS`
   - `model-outline.ts`: `BUILDING_BLOCK_READING_ORDER`, with
     `in_adapter` before `application_service`, then
     `out_adapter` and `technical_service` after `external_integration`,
     following the hexagon from outside in and out again
   - `design-doc-edit.ts`: `TYPES_OF.building_block`, so the unit editor
     offers them
     `PATTERN_ICONS` also satisfies `Record<BuildingBlockKind, unknown>`, so
     a kind the model gains fails the type check until it has an icon. The
     reading order satisfies `readonly BuildingBlockKind[]`. Two specs
     compare it and `TYPES_OF.building_block` with `BuildingBlockKind.options`,
     so neither list can miss a kind.

8. **The new block kinds in the architecture view** _(its own step;
   proposed)_. Today `ringOf` places none of the three, so the toolbar lists
   each as "Not drawn, as the design leaves their type as it is", which is
   wrong for them. The hexagon's adapter places are per port: one in
   adapter before each driving port (a behavior), and one out adapter
   behind each driven port (a block). To fill them, each adapter has to be
   matched to its port through the design's relations:
   - an `out_adapter` that `extends` a repository or an integration is the
     out adapter of that port
   - an `in_adapter` whose behavior invokes a driving port
     (`behavior_invokes_behavior`) is that port's in adapter

   An adapter that matches no port, and every `technical_service`, need a
   place of their own. One option is a ring outside the driven ports. That
   is a layout change (`layout-architecture.ts`) and a design question for
   the `design-system` skill. Until then, the toolbar's text should at
   least not blame the type: "Not drawn: the architecture view has no place
   for adapters and technical services yet".

## 2. Files

`src/features/system-model/`:

- `system-model-exploration.ts`:
  - `ExploredKind`
  - `explorationOf`: the four lists and `joinable`
  - `DRAWN_RELATIONS`: five entries
  - `SECTIONS`, `ElementSection['title']`, `KIND_WORD`
  - the header comment
- `ui/exploration/relation-colors.ts`: `EDGE_ARROW` for the five kinds
- `ui/exploration/element-node.tsx`: `REACH_ACTION` for the ten new reaches
- `ui/exploration/exploration-view.tsx`: the default set
- `ui/exploration/kind-list.tsx`: the sections, if decision 1 changes their
  shape
- `ui/exploration/themes/themes.ts`: the comment listing `--edge-*`
- `ui/exploration/themes/cyberarch/cyberarch.module.css`: five `--edge-*`

`src/shared/design-system/`:

- `theme.ts`: `relationEdges` for the five kinds, with `cyan`, `grape` and
  `yellow` taken from the theme's colours, and the comment
- `web-types.json`: the new `--noesis-diagram-edge-*` tokens

`src/features/design-docs/`:

- `ui/model-tree/kind-icon.tsx`
- `ui/model-tree/model-outline.ts`
- `design-doc-edit.ts`
- for decision 8: `design-doc-architecture.ts`, `architecture-outline.ts`,
  `ui/architecture/layout-architecture.ts`, `ui/architecture/diagram-toolbar.tsx`

`src/features/system-model/system-model.model.ts` is unchanged. Its
`null` cases and their comment stay right.

## 3. Fixtures

`test/fixtures/discounts-java.system-model.json`. What this example would
really have:

- **Collaborators:**
  - `DiscountCalculation` → `DiscountPolicyFactory` (`discountsFactory`)
  - `DiscountPolicyFactory` → `DiscountsConfigProvider`
    (`discountsConfigProvider`)
  - `DiscountPolicyFactory` → `UserStatusProvider` (`userStatusProvider`)
- **A deployable unit and a container:** `deployable_unit|discounts-app`
  ships `module|discounts`, and `deployment_container|Local JVM` runs it.
- **A library:** `library|discounts-domain` provides the calculation's
  value objects.
- **Two layers:**
  - `layer|domain` places the aggregates and value objects
  - `layer|application` places `DiscountCalculation`

A smaller, explicit model in the spec covers the edge cases (section 4).

## 4. Tests

`test/system-model-exploration.spec.tsx`:

- The four new elements become cards in no module, with their
  `kindWordOf`.
- Each of the five relations gives edges of its drawn kind.
- `neighboursOf` reaches and reads back each of the ten reaches.
- Two collaborator slots to one block give one edge.
- A relation to an element the model does not list gives no edge.
- `elementSectionsOf` lists the new sections only when the model holds
  such elements.
- The list of drawn kinds (line 414) gains the five.

Other specs:

- `test/system-model.spec.tsx`: `designOf` still drops the five relations,
  so the SPA never writes a relation the backend would refuse.
- `test/design-doc-architecture.spec.ts` (decision 8):
  - an `out_adapter` that extends a port, and an `in_adapter` that invokes
    one, fill their places
  - an adapter that matches no port, and a `technical_service`, are placed
  - no adapters still gives the placeholders
- `test/model-outline.spec.ts`: every block kind ranked, in order. _(Done.)_
- `test/kind-icon.spec.tsx`: the three icons. _(Done.)_
- `test/unit-editor.spec.tsx`: the type select offers every block kind.
  _(Done.)_

## 5. Steps

Each step leaves `bun run ci` green.

1. **`feat(frontend): know adapters and technical services`** (part B):
   decision 7, its icons from decision 6, and its tests. _(Done.)_
   1a. **`feat(frontend): place adapters and technical services in the
   architecture view`**: decision 8, after its design is approved.
2. **`feat(frontend): draw collaborators in the explorer`**: decision 3,
   its default from 4, the collaborator token in its proposed value, the
   fixture's collaborators, and tests.
3. **`feat(frontend): draw units, libraries, layers and containers in the
   explorer`**: decisions 1 and 2, the rest of 4, 5 and 6, the rest of the
   fixture, and tests.
4. The design proposal and `/design-sync` for decision 5 and for the filter
   sections. A change in look lands in `theme.ts` only.

Screenshots of steps 2 and 3 go in the pull request (the `pull-request`
skill).

## 6. Open questions

- Should `has_collaborator` read `works with` or `uses`? `uses` is shorter,
  but it is close to `invokes`.
- Should the explorer later offer a "Group by" choice instead of edges
  (module by default, then layer, library or unit) that redraws the frames
  by the chosen relation? It reads better for layers, but it needs the
  layout to support it. This plan draws edges, and grouping can follow.
- Should the architecture view's layer checks use `layer_contains_block`?
  That needs the design document to hold it, which is a backend change.
