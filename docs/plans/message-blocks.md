# Plan: commands, events and queries as building blocks

Status: built (November 2026). Decisions 6 and 7 follow the ones approved
for the same SPA change in step 3 of PR #106 (C, E and Q icons and tones on
the message blocks, a plain icon on a behavior, messages in the domain
core); the explorer gives messages the value object's bevel (section 10's
third question).

A behavior today says what it does: `ScannedBehavior.type` is one of
`Command`, `Event`, `Query`. The messages themselves — the classes annotated
`@Command`, `[Command]`, `@Event`, `[DddDomainEvent]` and so on — are
scanned as `value_object`, because the model has no kind for them. This plan
turns that around, as step 3 of PR #106 (`noesis_es_view`,
`docs/plans/new-system-model.md`, decisions 5 and 6) did: a message is a
building block of kind `command`, `event` or `query`, and a behavior has no
type.

Scope: the system model contract, the builder and its vocabularies, the
design document, the SPA, and what must follow them for `bun run ci` to stay
green (fixtures, committed examples, generated contracts, the skills' tables).
Out of scope: the parsers (`code-parsers/`, `parsers/`) and the annotation
libraries — every annotation this plan reads is already in the code model;
`Visibility`, actors, adapters, `has_collaborator` and the other step-3
kinds (`in_adapter`, `out_adapter`, `technical_service`).

## 1. Decisions

1. **Three new building block types**: `command`, `event`, `query`, added to
   `BuildingBlockType` after `external_integration`. They are values of the
   domain, like `aggregate`, `entity` and `value_object`: a block holds one
   as state (`has_state`), and a behavior takes or gives back one as input
   or output.
2. **A behavior has no type.** `BehaviorType` and `ScannedBehavior.type` go
   from the system model, `DesignedBehavior.type` from the design document.
   What a behavior does is read from the messages it takes and gives back.
3. **The handler annotations still make a behavior**, and say nothing more:
   Java's `@CommandHandler`, `@QueryHandler`, `@EventHandler` and C#'s
   `[DomainBehavior]`, `[EntryPoint]` keep the `behavior` role; the role
   loses its `type`, and `TriggeredBy` is no longer read.
4. **Vocabulary rows**: Java `@Command` → `command`, `@Query` → `query`,
   `@Event` → `event`; C# `[Command]` → `command`, `[Query]` → `query`,
   `[Event]` and `[DddDomainEvent]` → `event`. `[ReadModel]` stays
   `value_object`. Both tables live in the backend
   (`app/scanners/system-model-builders/`), so no parser changes.
5. **No migration code** (as decision 17 of the new-system-model plan): the
   committed system models and design documents, and the test fixtures, are
   converted by a script in the same pull request; a stored model of the old
   shape elsewhere fails the strict schema and is replaced by the next scan.
6. **The SPA moves the C, E and Q icons and tones from behaviors to the
   message blocks**; a behavior gets the plain behavior icon everywhere
   (tree, tooltip, cards, explorer). _(Proposed; goes through the
   `design-system` skill's proposal step before it is built, as step 3 did.)_
7. **Messages sit in the domain core** of the architecture view, beside the
   values, as what crosses the ports; the "type in no contract" check counts
   them with aggregates, entities and value objects. In the explorer they
   keep the value object's bevelled card, since they are values. _(Proposed.)_

## 2. The contract

`server/backend/src/app/system-model/system-model.ts`:

- `BuildingBlockType` gains `command`, `event`, `query`; its `.describe()`
  lists them with the domain's values ("the messages 'command', 'event',
  'query'"). Rename to `BuildingBlockKind` is not part of this plan.
- `BehaviorType` and its type go; `ScannedBehavior` loses `type`. Its
  `.describe()` is unchanged.
- `system-model-id.ts`, `element-id.ts`: no change.

## 3. The builder

`server/backend/src/app/scanners/system-model-builders/`:

- `vocabulary.ts`: `{ role: 'behavior' }` without `type`; `RoleArguments`
  loses `triggeredBy`; the `BehaviorType` import goes.
- `java.vocabulary.ts`: the three message rows map to their new types (the
  comment "the model has no message types" goes); the handler rows become
  plain `{ role: 'behavior' }`; `arguments.triggeredBy` goes.
- `csharp.vocabulary.ts`: the same for `CommandAttribute`, `QueryAttribute`,
  `EventAttribute`, `DddDomainEventAttribute`; `arguments.triggeredBy` goes.
- `build-system-model.ts`: `behaviorTypeOf` and the `type` it writes in
  `toBehavior` go; R9.4 is gone.
- `annotations.ts`: `enumArgument` loses its only caller; delete it.
- `docs/plans/code-model-to-system-model.md`: section 2's role table loses
  `TriggeredBy` and the fixed type; R9.4 is marked removed, pointing here;
  the message rows of the vocabulary tables name the new types.

## 4. The design document

`server/backend/src/app/design-docs/design-doc.ts`:

- `DesignedBehavior` loses `type`. `DesignedBuildingBlock.type` takes the new
  values through the shared enum.
- `server/backend/tools/design-doc.example.json` and the generated
  `plugins/claude-code/contracts/` (`bun run --cwd server/backend contracts`)
  follow; `contracts-json-schema.spec.ts` checks the example.

## 5. Stored files

One script (scratchpad, not kept) does, on every file below: drop `type`
from each behavior (system model) and each designed behavior (its
`{ value }` field); set a block's `type` to `command`, `event` or `query`
where the block is one of the messages. Which blocks are messages is read
from the code — the annotation on the class — not guessed from the name;
where a design document adds a message block that has no code yet, its kind
is decided by hand from the design's text.

- `examples/discounts-dotnet/.noesis/graph/system-models/2026-10-21_16-48_uncommitted.json`
- `examples/discounts-java/.noesis/graph/system-models/2026-10-22_18-01_uncommitted.json`
- `examples/qdoc-java/.noesis/graph/system-models/2026-10-22_18-36_uncommitted.json`
- the five `examples/*/.noesis/graph/changes/**/*.design-doc.json`
- `server/frontend/test/fixtures/discounts-java.system-model.json`,
  `qdoc-create-a-qdoc.design-doc.json`
- `server/backend/tools/design-doc.example.json`

A designed behavior whose `type` was the only thing a design changed on it
becomes an empty modification; the script drops it from `modified`.

## 6. Frontend

The SPA reads the types from the backend type-only, so every `BehaviorType`
import breaks at compile time and lists the work. By file, under
`server/frontend/src/`:

- `features/system-model/system-model.model.ts` (`designOf`): no `type` on a
  designed behavior.
- `features/system-model/system-model-exploration.ts`: `ExploredElement.pattern`
  is `BuildingBlockType | null`, null for a behavior, so the "Behaviors"
  section of the element filter has one group; the message blocks show up
  as three groups of "Building blocks".
- `features/system-model/ui/exploration/element-node.tsx`,
  `shared/ui/diagram-shapes.tsx`: the bevel for `value_object` extends to
  `command`, `event`, `query` (decision 7); `themes/*` keep working off
  `data-pattern`, so check each theme's CSS for a pattern list.
- `features/design-docs/ui/model-tree/kind-icon.tsx`: `PATTERNS` and
  `PATTERN_ICONS`/`PATTERN_TONES` key the C/E/Q icons and tones by
  `command`, `event`, `query`; the behavior entries go.
- `features/design-docs/ui/model-tree/model-outline.ts`:
  `BUILDING_BLOCK_READING_ORDER` ends with `command`, `query`, `event`;
  `patternLabelOf` gives "Command", "Query", "Event".
- `features/design-docs/design-doc-outline.ts`: a behavior's row has no
  pattern.
- `features/design-docs/ui/element-details/element-tooltip.tsx`: the
  signature's icon is the plain behavior icon.
- `features/design-docs/ui/element-details/body/sections/behaviors-section.tsx`,
  `element-cards-section.tsx`, `element-detail.tsx`: they read
  `patternLabel`, which is null for a behavior now; check that the cards
  of a block's behaviors no longer group by type and that nothing is left
  blank.
- `features/design-docs/architecture-outline.ts`: `PlacedElement` is keyed by
  id kind, its `pattern` a `BuildingBlockType | null` (as step 3 did).
- `features/design-docs/design-doc-architecture.ts`: `DOMAIN_CORE` gains the
  three types; a behavior's `pattern` is null.
- `features/design-docs/architecture-checks.ts`: `TYPES` gains the three; the
  check's text says "and message".
- `features/design-docs/building-block-types.ts`: nothing to change; the
  domain core's filter lists the new types once blocks carry them.
- `features/design-docs/design-doc-edit.ts`: `TYPES_OF.building_block` gains
  the three; `TYPES_OF.behavior` and `UNIT_FIELDS.behavior`'s `type` field
  go, so the behavior form loses its type select.
- `shell/search/search-entries.ts`: falls back to the kind for a behavior;
  no change beyond its spec.

Checks after building: the model tree, the element panel, the explorer and
the architecture view on `examples/discounts-dotnet` and `qdoc-java` (the
two with messages), in both themes, with screenshots for the pull request.
`/design-sync` is owed if `theme.ts` or a wrapper changes.

## 7. Skills

Only their tables and the sentences that name a behavior type:

- `create-design-doc/references/modelling.md` (line 119: "`Command` changes
  state, …") and `create-design-doc`, `update-design-doc` SKILL.md: a
  message is a block; a behavior is typed by nothing.
- `implement-java-spring` (`SKILL.md`, `references/mapping.md`,
  `building-blocks.md`): `@Command`/`@Query`/`@Event` on the message class
  map to the new kinds; the handler annotation marks the behavior only.
- `setup-java-scanner`, `setup-dotnet-scanner`: the annotation tables.

## 8. Tests

Backend (`server/backend/test/`):

- `unit/system-model.spec.ts`: a behavior with a `type` is refused; a block
  of each message type is accepted.
- `unit/system-model-builder.spec.ts`: R9.4's case goes; one case that the
  message annotations of each language give the three types, and one that a
  handler annotation still makes a behavior.
- `unit/java-parser.spec.ts`, `unit/csharp-parser.spec.ts`,
  `unit/java-parser-command.spec.ts`, `e2e-toolchain/java-parser.e2e.spec.ts`:
  these project the fixtures' existing code models; their expectations lose
  the behavior type and gain the message blocks' types. No fixture code
  model is regenerated.
- `unit/design-doc.spec.ts`, `fixtures/design-doc.fixture.ts`: no `type` on a
  designed behavior; a designed behavior carrying one is refused.

Frontend (`server/frontend/test/`): `kind-icon.spec.tsx` (icons by block
type, a behavior plain), `system-model-exploration.spec.tsx` (behavior
groups), `design-doc-architecture.spec.ts` (messages in the domain core,
the check's text), `design-doc-edit.spec.ts`, `unit-editor.spec.tsx` (no
type select on a behavior, the new block types offered),
`design-doc-outline.spec.ts`, `model-outline.spec.ts`,
`element-tooltip.spec.tsx`, `search-entries.spec.ts`, and the fixtures
`outline.fixture.ts`, `design-doc-outline.fixture.ts`.

## 9. Steps

One pull request, green on `bun run ci` and `bun run test:e2e:toolchain`
(the toolchain asserts the example models), committed in this order so each
commit compiles:

1. Contract, builder, vocabularies, design document, backend tests,
   regenerated contracts (`feat(system-model)!`).
2. SPA and its tests, after the design-system proposal for decisions 6 and 7
   is approved (`feat(frontend)`).
3. Committed examples and fixtures converted by script (`chore(examples)`);
   in practice folded into steps 1 and 2 wherever a test reads them.
4. Skills and `code-model-to-system-model.md` (`chore(docs)`).

## 10. Open questions

- Should the scan say what a handler handles? `@CommandHandler void
  handle(PlaceOrder command)` already reads as such through its `has_input`
  to a `command` block, so nothing is lost for a handler that takes its
  message; a handler that takes none loses its type. Proposed: accept it.
- C# `[EntryPoint(TriggeredBy = …)]`: no example uses it, so only the
  builder's unit fixtures carry it; in a codebase that does, the argument
  stays in the code and is ignored. Proposed: accept it.
- The explorer's look for messages (decision 7): the bevel, or a card of
  their own. Decided in the design-system proposal.
