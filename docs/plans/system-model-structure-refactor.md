# Plan: the system model as flat elements and one list of relations

Status: proposed (November 2026).

`server/backend/src/app/system-model/system-model.ts` nests what an element
has (properties, input, output, its own relations) inside the element. This
plan makes every element flat and keeps every relation in one list beside
the elements: an element carries only what is its own, a relation carries
what a diagram puts on its edge. It changes the **structure only**. It adds
no element kind and no relation kind the model does not have today, and
keeps today's vocabulary: the eight building block types, the behavior
types, visibility, the rule categories and types, rules and scenarios
nested where they are.

## 1. What stays, what moves, what goes

### Stays (vocabulary, not structure)

- `BuildingBlockType` with its eight values.
- `BehaviorType` on a behavior (`Command` / `Event` / `Query`).
- `Visibility` on a behavior, actors as strings.
- `RuleCategory`, `RuleType`, `RULE_TYPES_OF`; rules nested in modules,
  blocks and behaviors; scenarios nested in blocks, behaviors and rules.
- The eight primitives.
- `SystemModel`'s `id`, `name`, `scanned_at`, `commit` and its `.describe()`.
- `element-id.ts`: three id kinds; its one change is the enum rule of
  section 2.4.

### Moves

| Today                                                              | After                                                                                                                         |
| ------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------- |
| `relation.ts`: per-holder unions, `relationsOf`, `isContainment`   | Gone; every relation schema lives in `system-model.ts`, one `Relation` discriminated union                                    |
| `element.relations` on each module, block and behavior             | `SystemModel.relations`, one list, sorted, unique                                                                             |
| `ScannedBuildingBlock.properties` (`ScannedProperty`)              | `has_state` relations: `{ from: block, to: TypeId, name, cardinality }`                                                       |
| `ScannedBehavior.input` (`ScannedParameter`)                       | `has_input` relations: `{ from: behavior, to: TypeId, name, cardinality, position }`                                          |
| `ScannedBehavior.output` (`ScannedResult`, at most one)            | `has_output` relation: `{ from: behavior, to: TypeId, name: 'result', cardinality }`                                          |
| `BuildingBlockRef` = id or `{ collectionOf }`, `optional: boolean` | `TypeId` = `BuildingBlockId \| PrimitiveId`, never a wrapper; `Cardinality` = `'0..1' \| '1' \| '*'`                          |
| `PRIMITIVES` array, `PrimitiveId` by a hand-joined regex           | `PrimitiveName` zod enum (exported), `PrimitiveId` a `z.templateLiteral` over it                                              |
| `SourceLocation` = `{ path, line: int \| null }`                   | `SourceLocation` = `{ path, startLine, endLine }`, each line an int ≥ 1 or null                                               |
| `module_contains_module`, `module_contains_building_block`         | `module_contains_module`, `module_contains_block`                                                                             |
| `extends`, `exposes`, `behavior_invokes_behavior`                  | Same kinds, now `ScannedRelation.extend(...)`                                                                                 |
| `behavior_invokes_behavior` with no attribute                      | `behavior_invokes_behavior` with `order` (int ≥ 1), the call's position in the caller; a target called twice keeps its first  |
| Each `Scanned*` written out field by field                         | `ScannedElement` base (`id`, `name`, `description`, `source`) and `ScannedRelation` base (`kind`, `from`, `to`), both private |
| No `.describe()` on elements and relations                         | A `.describe()` on every schema the JSON Schema shows                                                                         |

### Goes

- `Collection`, `CollectionInput`, `BuildingBlockRef`, `BuildingBlockRefInput`:
  a collection is said by `cardinality`. A collection is `*` whether or not
  it may be empty: the code does not say. A collection of collections
  becomes `*` of the innermost element, with a builder diagnostic.
- `optional` on a property, parameter or result: `0..1` when nullable or an
  optional wrapper, `1` otherwise.
- `description` on a property, parameter or result: a relation carries no
  description (projection rule R5.6 goes). What a slot means is the
  description of the block or primitive it points at.
- `ScannedProperty`, `ScannedParameter`, `ScannedResult` and their `Designed*`
  mirrors, the `properties`, `input`, `output` and `relations` change sets of
  a designed element.

## 2. The contract

### 2.1 `system-model.ts`

The file reads in this order: what every element and relation is built from,
the parts elements share (rules, scenarios), the elements, what types a
slot, the relations, the model. The target, in full:

```ts
import { z } from 'zod';
import {
  BehaviorId,
  BuildingBlockId,
  ElementName,
  ModuleId,
} from '#backend/app/element-id';
import { SystemModelId } from './system-model-id';

/*
 * What every element and every relation of the model is built from. The
 * parts elements share follow, then the elements, each kind with the
 * vocabulary it alone uses, then what types a slot, then the relations,
 * then the model that holds them all.
 */

export const SourceLocation = z
  .strictObject({
    path: z.string(),
    startLine: z
      .int()
      .min(1)
      .nullable()
      .default(null)
      .describe(
        'The first line of the element, counting from 1; null when unknown.',
      ),
    endLine: z
      .int()
      .min(1)
      .nullable()
      .default(null)
      .describe(
        'The last line of the element, counting from 1; null when unknown.',
      ),
  })
  .describe(
    'Where an element was found: a file by its path from the repository root, and the lines it spans in it, each when known.',
  );
export type SourceLocation = z.infer<typeof SourceLocation>;

/**
 * What every element of the model carries: its id, its name, an optional
 * description and where it was found. Each kind of element narrows the id
 * and adds what is its own.
 */
const ScannedElement = z.strictObject({
  id: z.string(),
  name: ElementName,
  description: z.string().nullable().default(null),
  source: SourceLocation,
});

/**
 * What every relation of the model carries: its kind and its two ends. Each
 * kind of relation fixes the kind, narrows the ends and adds its edge data.
 * The relations between elements are one list for all of them: an element
 * carries only what is its own, and a relation carries what the diagram
 * puts on its edge — a name, a cardinality, an order. Containment is in the
 * id too (`building_block|sales.orders.Order` is in `module|sales.orders`)
 * and is written as a relation as well, so the list is complete.
 */
const ScannedRelation = z.strictObject({
  kind: z.string(),
  from: z.string(),
  to: z.string(),
});

/** What a behavior's output is named: the code gives a return value no name of its own. */
export const OUTPUT_NAME = 'result';

/* The parts elements share: rules and the scenarios that illustrate them. */

export const RuleCategory = z
  .enum(['Business', 'Quality', 'Constraint'])
  .describe(
    "What a rule is: 'Business', a truth of the domain; 'Quality', a measurable quality the system must have (ISO/IEC 25010); 'Constraint', a limit imposed on the solution from outside the domain.",
  );
export type RuleCategory = z.infer<typeof RuleCategory>;

export const BusinessRuleType = z.enum([
  'Consistency',
  'Structure',
  'Computation',
  'State change',
]);
export const QualityRuleType = z.enum([
  'Performance',
  'Security',
  'Reliability',
  'Usability',
  'Compatibility',
  'Maintainability',
  'Portability',
]);
export const ConstraintRuleType = z.enum([
  'Technology',
  'Regulation',
  'Interface',
  'Organisation',
]);

export const RuleType = z
  .enum([
    ...BusinessRuleType.options,
    ...QualityRuleType.options,
    ...ConstraintRuleType.options,
  ])
  .describe(
    `The kind of rule within its category. Business: ${BusinessRuleType.options.join(', ')}. Quality: ${QualityRuleType.options.join(', ')}. Constraint: ${ConstraintRuleType.options.join(', ')}.`,
  );
export type RuleType = z.infer<typeof RuleType>;

/** The rule types each category allows. */
export const RULE_TYPES_OF: Record<RuleCategory, readonly RuleType[]> = {
  Business: BusinessRuleType.options,
  Quality: QualityRuleType.options,
  Constraint: ConstraintRuleType.options,
};

export const ScenarioStepKind = z
  .enum(['given', 'when', 'then'])
  .describe(
    "Which part of a scenario a step is: 'given' sets the starting state, 'when' is the action, 'then' the outcome.",
  );
export type ScenarioStepKind = z.infer<typeof ScenarioStepKind>;

export const ScenarioStep = z
  .strictObject({ kind: ScenarioStepKind, text: z.string() })
  .describe('One step of a scenario: its kind and what it says.');
export type ScenarioStep = z.infer<typeof ScenarioStep>;

export const ScenarioSteps = z
  .array(ScenarioStep)
  .min(1)
  .describe(
    'The steps in reading order; each kind may repeat or be left out, but there is at least one step. Consecutive steps of one kind read as "And".',
  );

export const ScannedScenario = z
  .strictObject({
    name: ElementName,
    description: z.string().nullable().default(null),
    steps: z.array(ScenarioStep).default([]),
  })
  .describe(
    'A scenario as a scan found it: code carries its title and little else, so the description and the steps may be missing.',
  );
export type ScannedScenario = z.infer<typeof ScannedScenario>;

export const ScannedRule = z
  .strictObject({
    name: ElementName,
    category: RuleCategory.default('Business'),
    ruleType: RuleType,
    description: z.string().nullable().default(null),
    scenarios: z.array(ScannedScenario).default([]),
  })
  .describe(
    'A rule the element that holds it follows, with the scenarios that illustrate it.',
  );
export type ScannedRule = z.infer<typeof ScannedRule>;

/* The elements, in the order the model lists them. */

export const ScannedDomainModule = ScannedElement.extend({
  id: ModuleId,
  rules: z.array(ScannedRule).default([]),
}).describe(
  "A module: a package or namespace of the code that groups building blocks and other modules; 'module_contains_module' relations name the modules in it, 'module_contains_block' relations the blocks.",
);
export type ScannedDomainModule = z.infer<typeof ScannedDomainModule>;

export const BuildingBlockType = z
  .enum([
    'aggregate',
    'entity',
    'value_object',
    'domain_service',
    'application_service',
    'repository',
    'factory',
    'external_integration',
  ])
  .describe(
    "What a building block is. The domain's values: 'aggregate', 'entity', 'value_object'. The parts that do the work: 'domain_service', 'application_service', 'repository', 'factory', 'external_integration'.",
  );
export type BuildingBlockType = z.infer<typeof BuildingBlockType>;

export const ScannedBuildingBlock = ScannedElement.extend({
  id: BuildingBlockId,
  type: BuildingBlockType,
  rules: z.array(ScannedRule).default([]),
  scenarios: z.array(ScannedScenario).default([]),
}).describe(
  'A building block: a class, interface, struct or enum of the code that an annotation names as one of the types; its state and the behaviors it exposes are relations.',
);
export type ScannedBuildingBlock = z.infer<typeof ScannedBuildingBlock>;

export const BehaviorType = z
  .enum(['Command', 'Event', 'Query'])
  .describe(
    "What a behavior does: a 'Command' changes state, an 'Event' says something happened, a 'Query' asks for data.",
  );
export type BehaviorType = z.infer<typeof BehaviorType>;

export const Visibility = z
  .discriminatedUnion('kind', [
    z.strictObject({ kind: z.literal('private') }),
    z.strictObject({ kind: z.literal('public'), actors: z.array(z.string()) }),
  ])
  .describe(
    "Who may call a behavior: 'private' nobody outside the code, 'public' the actors it names.",
  );
export type Visibility = z.infer<typeof Visibility>;

export const ScannedBehavior = ScannedElement.extend({
  id: BehaviorId,
  type: BehaviorType,
  visibility: Visibility,
  rules: z.array(ScannedRule).default([]),
  scenarios: z.array(ScannedScenario).default([]),
}).describe(
  "A behavior: a public method of a building block, named by the block's id path and its own name; its inputs, output and the behaviors it invokes ('behavior_invokes_behavior') are relations.",
);
export type ScannedBehavior = z.infer<typeof ScannedBehavior>;

/* What types a slot — a piece of state, an input, an output — and how many values it holds. */

const PRIMITIVE_KIND = 'primitive';

/** The model's built-in types, the part after `primitive|`. */
export const PrimitiveName = z.enum([
  'string',
  'integer',
  'decimal',
  'boolean',
  'date',
  'datetime',
  'duration',
  'uuid',
]);
export type PrimitiveName = z.infer<typeof PrimitiveName>;

export const PrimitiveId = z
  .templateLiteral([`${PRIMITIVE_KIND}|`, PrimitiveName])
  .describe(
    `A built-in building block's id: '${PRIMITIVE_KIND}|', then one of ${PrimitiveName.options.join(', ')}, e.g. '${PRIMITIVE_KIND}|uuid'.`,
  )
  .brand<'PrimitiveId'>();
export type PrimitiveId = z.infer<typeof PrimitiveId>;

export const TypeId = z
  .union([BuildingBlockId, PrimitiveId])
  .describe(
    "What a slot (a piece of state, an input, an output) is typed by: a building block's id or a primitive's, never a wrapper. A collection is said by the relation's cardinality, never by the type.",
  );
export type TypeId = z.infer<typeof TypeId>;

export const Cardinality = z
  .enum(['0..1', '1', '*'])
  .describe(
    "How many values the slot holds: '1' exactly one, '0..1' one or none, '*' any number. A collection is '*' whether or not it may be empty: the code does not say.",
  );
export type Cardinality = z.infer<typeof Cardinality>;

/**
 * A named slot: a relation its holder may have several of to one type, so
 * it is one of a kind by its holder and `name`, never by `to`, and holds
 * `cardinality` of what it points at. A design may then change what it
 * points at, and how many, in place.
 */
const NamedSlotRelation = ScannedRelation.extend({
  name: ElementName,
  cardinality: Cardinality,
});

/* The relations, one schema a kind, then their union. */

export const ModuleContainsModuleRelation = ScannedRelation.extend({
  kind: z.literal('module_contains_module'),
  from: ModuleId,
  to: ModuleId,
}).describe(
  "A module holds a module, `to`'s id path being `from`'s path and its own name.",
);

export const ModuleContainsBlockRelation = ScannedRelation.extend({
  kind: z.literal('module_contains_block'),
  from: ModuleId,
  to: BuildingBlockId,
}).describe(
  "A module declares a building block, `to`'s id path being `from`'s path and its own name.",
);

export const ExtendsRelation = ScannedRelation.extend({
  kind: z.literal('extends'),
  from: BuildingBlockId,
  to: BuildingBlockId,
}).describe('A building block extends or implements another.');

export const HasStateRelation = NamedSlotRelation.extend({
  kind: z.literal('has_state'),
  from: BuildingBlockId,
  to: TypeId,
}).describe(
  "A building block's piece of state: a field or property named `name`, typed by `to`, holding `cardinality` values.",
);

export const ExposesRelation = ScannedRelation.extend({
  kind: z.literal('exposes'),
  from: BuildingBlockId,
  to: BehaviorId,
}).describe(
  "A building block exposes a behavior; the behavior's id path is the block's path and its own name.",
);

export const HasInputRelation = NamedSlotRelation.extend({
  kind: z.literal('has_input'),
  from: BehaviorId,
  to: TypeId,
  position: z
    .int()
    .min(1)
    .describe(
      'Where the parameter stands in the signature, counting from 1; the parameters of a behavior read in this order.',
    ),
}).describe(
  'A parameter of a behavior: named `name`, typed by `to`, holding `cardinality` values, the `position`th of its signature.',
);

export const HasOutputRelation = NamedSlotRelation.extend({
  kind: z.literal('has_output'),
  from: BehaviorId,
  to: TypeId,
  name: z
    .literal(OUTPUT_NAME)
    .describe(
      "Always 'result': a return value has no name of its own, and the slot is known by it so its type may change in place.",
    ),
}).describe(
  "What a behavior gives back: the slot named 'result', typed by `to`, holding `cardinality` values; a behavior has at most one.",
);

export const BehaviorInvokesBehaviorRelation = ScannedRelation.extend({
  kind: z.literal('behavior_invokes_behavior'),
  from: BehaviorId,
  to: BehaviorId,
  order: z
    .int()
    .min(1)
    .describe(
      'The position of the call within the calling behavior, counting from 1; a behavior called twice keeps its first.',
    ),
}).describe(
  'A behavior calls another behavior, as its `order`th call; a behavior never calls itself.',
);

export const Relation = z.discriminatedUnion('kind', [
  ModuleContainsModuleRelation,
  ModuleContainsBlockRelation,
  ExtendsRelation,
  HasStateRelation,
  ExposesRelation,
  HasInputRelation,
  HasOutputRelation,
  BehaviorInvokesBehaviorRelation,
]);
export type Relation = z.infer<typeof Relation>;

export const SystemModel = z
  .strictObject({
    id: SystemModelId,
    name: z.string(),
    scanned_at: z.string(),
    commit: z
      .string()
      .regex(/^[0-9a-f]{4,40}$/)
      .nullable()
      .default(null)
      .describe(
        'Short hash of the commit scanned; null when the repository has none.',
      ),
    modules: z.array(ScannedDomainModule).default([]),
    buildingBlocks: z.array(ScannedBuildingBlock).default([]),
    behaviors: z.array(ScannedBehavior).default([]),
    relations: z.array(Relation).default([]),
  })
  .describe(
    'The implemented model as one scan found it: graph/system-models/YYYY-MM-DD_HH-MM_<commit>.json, the scan minute in UTC. Every scan is kept, except that one in the same minute on the same commit replaces the one before; the highest id is the newest.',
  );
export type SystemModel = z.infer<typeof SystemModel>;
```

The `.describe()` texts of `BehaviorType`, `Visibility`, `ScannedScenario`
and `ScannedRule` are new; the rest carry over or are rewritten to name the
relations that replaced the nested parts.

### 2.2 Uniqueness: `design-docs/relation-key.ts` (new)

A relation is unique by `(kind, from, to)`, except a named slot
(`has_state`, `has_input`, `has_output`), unique by `(kind, from, name)`: a
block may hold two slots of one type, and a design may change a slot's type
in place.

```ts
import { Relation } from '#backend/app/system-model/system-model';

/** What a relation is keyed by: its kind and holder, then its `to` for an edge, or its name for a named slot. */
export type RelationKey =
  | { readonly kind: string; readonly from: string; readonly to: unknown }
  | { readonly kind: string; readonly from: string; readonly name: string };

/** The named slots, read off the schemas: every relation kind whose shape has a `name`. */
export const NAMED_SLOT_KINDS: ReadonlySet<string> = new Set(
  Relation.options
    .filter((option) => 'name' in option.shape)
    .map((option) => option.shape.kind.value),
);

/** The key a relation is unique by: `kind|from|to`, or `kind|from|#name` for a named slot. */
export const relationKeyOf = (relation: RelationKey): string =>
  NAMED_SLOT_KINDS.has(relation.kind) && 'name' in relation
    ? `${relation.kind}|${relation.from}|#${relation.name}`
    : `${relation.kind}|${relation.from}|${'to' in relation ? String(relation.to) : ''}`;
```

### 2.3 Order: `scanners/system-model-builders/relation-order.ts` (new)

Relations are sorted by kind, holder, position, target, then name or
order, so two builds give one file and a signature reads in its order.

```ts
import type { Relation } from '#backend/app/system-model/system-model';

export const byRelation = (a: Relation, b: Relation): number =>
  byCodeUnit(a.kind, b.kind) ||
  byCodeUnit(a.from, b.from) ||
  positionOf(a) - positionOf(b) ||
  byCodeUnit(a.to, b.to) ||
  byCodeUnit(nameOf(a), nameOf(b)) ||
  orderOf(a) - orderOf(b);

const nameOf = (relation: Relation) =>
  'name' in relation ? relation.name : '';
const orderOf = (relation: Relation) =>
  'order' in relation ? relation.order : 0;
const positionOf = (relation: Relation) =>
  'position' in relation ? relation.position : 0;

/** Ids are ASCII, so code-unit order is alphabetical without a locale. */
const byCodeUnit = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);
```

### 2.4 Every fixed vocabulary is one zod enum

A value set that is listed on its own is one `z.enum` whose inferred type is
the domain type, and everything else derives from it. A discriminator of a
union (`Relation.kind`, `Visibility.kind`) is a bare `z.literal` on each
member: the union itself is the list, and its kinds are read off it
(`Relation.options`), never listed a second time.

| Vocabulary                                                              | Today                                                                              | After                                                                                                                                              |
| ----------------------------------------------------------------------- | ---------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| `BuildingBlockType`, `BehaviorType`, `RuleCategory`, `ScenarioStepKind` | `z.enum`                                                                           | Unchanged                                                                                                                                          |
| `RuleType`                                                              | Three `as const` arrays spread into one `z.enum`; `RULE_TYPES_OF` lists the arrays | `BusinessRuleType`, `QualityRuleType`, `ConstraintRuleType` as `z.enum`s; `RuleType` an enum of their `.options`; `RULE_TYPES_OF` reads `.options` |
| `PrimitiveName`                                                         | `PRIMITIVES` string array joined into a regex                                      | `z.enum`; `PrimitiveId` a template literal over it                                                                                                 |
| `Cardinality`                                                           | `z.enum` of four                                                                   | `z.enum` of three                                                                                                                                  |
| `ElementKind` (`element-id.ts`)                                         | Three `X_KIND` string constants                                                    | `ElementKind = z.enum(['module', 'building_block', 'behavior'])`; each `X_KIND` reads `ElementKind.enum.x`                                         |
| `Relation.kind`, `Visibility.kind`                                      | `z.literal('…')` per member                                                        | Unchanged                                                                                                                                          |

Anything that lists a vocabulary's values reads it off the schema, as
`NAMED_SLOT_KINDS` does: `relationKeyOf`, `byRelation`, the frontend's
selects (`design-doc-edit.ts` already imports `Visibility` and `RuleType` as
values) and a test's `it.each`. `OUTPUT_NAME` stays a single literal: one
value is no vocabulary. The vocabularies (`vocabulary.ts`) take
`PrimitiveName` from the model instead of restating the union.

## 3. The builder

`server/backend/src/app/scanners/system-model-builders/`:

- `build-system-model.ts`: `assemble()` returns the three element lists and
  one `relations` list sorted by `byRelation`. The nested `relations`,
  `propertiesOf`, `input` and `output` become relation emitters:
  - R6: `module_contains_module` and `module_contains_block` from each
    module to its children (as today, moved to the list).
  - R4.4: `extends`; R9.3: `exposes` (as today, moved).
  - R5: one `has_state` per public property or field, `cardinality` by
    R5.4, no `description`.
  - R9.6, R9.7: one `has_input` per parameter with `position` = its index
    counting from 1; one `has_output` named `result` when the method returns
    something.
  - R11.3: `collectInvocations` keeps the call site's `location` and yields
    `order` per target by the call's position in the calling method, first
    call of a target wins; calls reached through a method that is no
    behavior come at that call's position. `Set<BehaviorId>` becomes a map
    of target to order.
  - R4.6, R9.10: `toSourceLocation` takes `startLine` and `endLine` from the
    code model's `SourceSpan` (it has both already): a line below 1 is null,
    an end before the start is null; a module's directory (`directoryAbove`)
    has neither; a node with no location keeps `path: ''` and null lines, as
    today.
- `type-resolution.ts`: resolves to `{ ref: TypeId, cardinality }` instead of
  a `BuildingBlockRef` that may wrap a collection; a collection is `*`; a
  nested collection flattens to the innermost element with a diagnostic.
- `vocabulary.ts`, `java.vocabulary.ts`, `csharp.vocabulary.ts`: import
  paths only (`relation.ts` is gone) and `PrimitiveName` for the primitive
  rows' type; no row changes.
- `adapters/out/scanners/server-scan-log.ts`: prints `startLine`.

The builder keeps its property: two builds of one code model give one file,
every drop a diagnostic.

## 4. Design documents

`server/backend/src/app/design-docs/design-doc.ts` mirrors the contract:

- `DesignedDomainModule`, `DesignedBuildingBlock`, `DesignedBehavior` lose
  `relations`, `properties`, `input`, `output`; they keep `type`,
  `visibility`, `rules`, `scenarios`, `definition`, `diagram`.
- The document gains `relations: changeSet(DesignedRelation, DesignedRelationKey)`:
  - `DesignedRelation` is the scanned shape with what is not the relation's
    identity as `DesignDocField`s, so a design may change it in place: a
    named slot's `to` and `cardinality`, `has_input.position`,
    `behavior_invokes_behavior.order`. Every other relation is its scanned
    shape as is.
  - `DesignedRelationKey` is what a design removes a relation by: `kind`,
    `from`, `to`, and for a named slot `name` too, so the key says what was
    removed in full.

  ```ts
  const designedSlot = <To extends z.ZodType>(to: To) => ({
    to: DesignDocField(to),
    cardinality: DesignDocField(Cardinality),
  });
  export const DesignedRelation = z.discriminatedUnion('kind', [
    ModuleContainsModuleRelation,
    ModuleContainsBlockRelation,
    ExtendsRelation,
    HasStateRelation.extend(designedSlot(TypeId)),
    ExposesRelation,
    HasInputRelation.extend({
      ...designedSlot(TypeId),
      position: DesignDocField(HasInputRelation.shape.position),
    }),
    HasOutputRelation.extend(designedSlot(TypeId)),
    BehaviorInvokesBehaviorRelation.extend({
      order: DesignDocField(BehaviorInvokesBehaviorRelation.shape.order),
    }),
  ]);
  export const DesignedRelationKey = z.discriminatedUnion('kind', [
    ModuleContainsModuleRelation.pick({ kind: true, from: true, to: true }),
    ModuleContainsBlockRelation.pick({ kind: true, from: true, to: true }),
    ExtendsRelation.pick({ kind: true, from: true, to: true }),
    HasStateRelation.pick({ kind: true, from: true, to: true, name: true }),
    ExposesRelation.pick({ kind: true, from: true, to: true }),
    HasInputRelation.pick({ kind: true, from: true, to: true, name: true }),
    HasOutputRelation.pick({ kind: true, from: true, to: true, name: true }),
    BehaviorInvokesBehaviorRelation.pick({ kind: true, from: true, to: true }),
  ]);
  ```

- `keyOf` keys a relation with `relationKeyOf`; `partsMissingFrom` already
  walks any change set by key, so the document-level `relations` set needs
  no special case beyond that.
- Writer's rules:
  - `uncontained` reads `document.relations`: an element the design adds
    under another has a `module_contains_*` or `exposes` added for it.
  - `unknownRelationEnd` (new): both ends of every added or modified
    relation exist, in the design or in the system model.
  - `containmentOutsideIdPath` (new): a `module_contains_module` or
    `module_contains_block` agrees with the id path, `to` being `from`'s
    path and its own name.
- `adapters/in/mcp/tool-handler.ts`: the design document's JSON Schema text
  that names the nested shapes.
- Fixtures: `test/fixtures/design-doc.fixture.ts`, `tools/design-doc.example.json`.

## 5. Frontend

`server/frontend/src/features/`:

- `system-model/system-model.model.ts` (`designOf`): the three element lists
  without nested parts, plus `relations: { added: model.relations, removed: [] }`.
- `system-model/system-model-exploration.ts`: the graph is the relations
  list read as is. "Uses" edges become `has_state`, `has_input` and
  `has_output`, drawn apart under State, Input and Output filters, in one
  table (`DRAWN_RELATIONS`) that names the model kinds each drawn relation
  reads; `behavior_invokes_behavior` keeps `order`; `extends` and the two
  containment kinds are filters. `ui/exploration/relation-colors.ts`,
  `element-node.tsx`, `shared/design-system/theme.ts` (an `extends` edge
  look: `/design-sync` is owed after).
- `design-docs/relations.ts` (new): reading a design's relations by holder,
  by kind and by end, for the panels and forms.
- `design-docs/design-doc-edit.ts`: the property, parameter and result forms
  keep their shape in the UI but read and write relations; a cardinality
  select replaces the optional checkbox. No generic relation editor.
- `design-docs/design-doc-architecture.ts`, `architecture-outline.ts`,
  `architecture-checks.ts`, `design-doc-outline.ts`: read
  `behavior_invokes_behavior`, `exposes`, `has_*` from the list instead of
  the element.
- `design-docs/ui/element-details/`: `change-list-items.ts`,
  `property-signature-section.tsx`, `behavior-sections.tsx`,
  `building-block-sections.tsx`, `part-sections.tsx`,
  `property-sections.tsx`, `sections/declaration-box.tsx`,
  `writable-declaration-box.tsx`, `behaviors-section.tsx`,
  `element-detail.tsx`, `element-tooltip.tsx`, `ref-address.ts`.
- `design-docs/ui/unit-editor/unit-fields.tsx`, `unit-editor-modal.tsx`.
- `design-docs/design-doc-field.ts`, `element-id.ts`, `change-set.ts`: the
  key of a relation change.
- The outline and the tooltips read a slot as `Type [*]` or `Type [0..1]`
  (`design-doc-outline.ts`, `element-tooltip.tsx`, `unit-fields.tsx`). No
  frontend file reads an element's `source`, so the `SourceLocation` change
  touches the SPA only through its fixtures.

No visible change in kind: the same panels and forms show the same facts
read from the list. A cardinality select instead of a checkbox goes through
the `design-system` skill's proposal step.

## 6. Stored files and the contract

- `bun run contracts` regenerates `plugins/claude-code/contracts/system-model.schema.json`
  and `design-document.schema.json`; `contracts-json-schema.spec.ts` checks
  the example documents against them.
- No migration code: the service is pre-release. A stored system model of
  the old shape stays on disk unread (`findNewest` reads only the files of
  the latest minute). The committed files are converted by a one-off script
  kept in the scratchpad, not committed:
  - `examples/{discounts-dotnet,discounts-java,qdoc-java}/.noesis/graph/system-models/*.json`
    (seven files; the old qdoc ones too, so the folder has one shape).
  - The five `examples/**/*.design-doc.json`.
  - `server/frontend/test/fixtures/discounts-java.system-model.json`,
    `qdoc-create-a-qdoc.design-doc.json`.
  - `server/backend/tools/design-doc.example.json`.
  - The conversion: each `properties[i]` → `has_state`, `input[i]` →
    `has_input` with `position: i + 1`, `output[0]` → `has_output` named
    `result`; `{ collectionOf: T }` → `to: T, cardinality: '*'`;
    `optional: true` → `'0..1'`, else `'1'`; nested `relations` lifted; a
    `behavior_invokes_behavior` gets `order` by its index in the element's
    sorted list; `source.line` → `source.startLine` with `endLine: null`.
    The real order and end lines come with the next real scan.
- The example models are regenerated for real only when the examples are
  rescanned; the e2e toolchain tests assert the converted shape until then.

## 7. Skills and documents

Text only, where the nested shape is spelled out:

- `plugins/claude-code/skills/create-design-doc/SKILL.md`,
  `references/modelling.md`; `update-design-doc/SKILL.md`: elements and
  relations as two halves of a design; cardinality on a slot (`*` for any
  collection); `position` on a parameter; `result` as the output's name.
- `implement-java-spring/SKILL.md`, `references/mapping.md`,
  `references/building-blocks.md`: how a `has_state` / `has_input` /
  `has_output` reads back into fields and signatures; `*` maps to a
  `List<T>`, not checked non-empty.
- `setup-java-scanner/SKILL.md`, `setup-dotnet-scanner/SKILL.md`: the
  example model excerpts.
- `docs/plans/code-model-to-system-model.md`: R4.4, R5, R5.4, R5.6, R6, R7.3,
  R9.3, R9.6, R9.7, R10.1, R11.3 edited in place; `docs/arch/code-model.md`
  where it shows a model.

## 8. Tests

- `test/unit/system-model.spec.ts`: the element lists, every relation
  variant (ends of the right kind, edge data present, a stray key refused),
  the named slots, `Cardinality`, `PrimitiveName` (`it.each` over
  `.options`), `SourceLocation` with both lines, the defaults spelled out on
  the way back; today's cases for `BehaviorType`, `Visibility`, rules and
  scenarios stay.
- New `relation-key.spec.ts` (a named slot keyed by name, an edge by its
  target) and `relation-order.spec.ts` (kind, holder, position, target,
  name, order).
- `system-model-builder.spec.ts`: one case per rule in section 3; the
  nested expectations become relation expectations. A `test/support/relations.ts`
  helper builds them.
- `java-parser.spec.ts`, `csharp-parser.spec.ts`,
  `test/support/csharp-fixture-expectations.ts`, `test/e2e-toolchain/*.e2e.spec.ts`,
  `scanner.spec.ts`: the shop fixtures' expected relations,
  `behavior_invokes_behavior` with `order`, sources with `startLine` and
  `endLine`.
- `design-doc.spec.ts`, `design-doc-handlers.spec.ts`,
  `stored-design-doc.spec.ts`, `mcp-server.spec.ts`: fixtures in the new
  shape; the two new writer's rules.
- `server/frontend/test/`: `system-model-exploration.spec.tsx`,
  `design-doc-architecture.spec.ts`, `design-doc-edit.spec.ts`,
  `design-doc-outline.spec.ts`, `element-detail.spec.tsx`,
  `element-tooltip.spec.tsx`, `unit-editor.spec.tsx`, `search-entries.spec.ts`,
  `packaging.spec.tsx` and the fixtures.

Green on `bun run ci`; `bun run test:e2e:toolchain` for the converted
examples.

## 9. Steps

One branch, one pull request, commits in this order so each is green:

1. **Contract.** `system-model.ts` rewritten (section 2.1), `relation.ts`
   deleted, `relation-key.ts` and `relation-order.ts` added, `ElementKind`
   in `element-id.ts`, `system-model.spec.ts` and the two new specs,
   contracts regenerated.
2. **Builder.** Section 3, with its specs and the parser specs.
3. **Design document.** Section 4, with its specs and fixtures, the MCP
   handler's schema text.
4. **Frontend.** Section 5, with its specs and fixtures; `/design-sync` for
   the edge look.
5. **Stored examples.** Section 6's conversion script run once; e2e toolchain.
6. **Skills and documents.** Section 7.

## 10. Not in this plan

- Renaming `BuildingBlockType` to `BuildingBlockKind`: a rename that ripples
  through the frontend for no structural gain.
- New element kinds (actors, manual processes, deployable units, libraries,
  layers, deployment containers, rules and scenarios as elements with ids)
  and new relation kinds (`has_collaborator`, `governs`, `illustrates`,
  `performs`, a process invoking a behavior, a unit, library or layer
  holding something).
- New vocabulary: more building block types, a rule kind in place of
  category and type, a behavior without a type, a model without visibility.
- A generic relation editor in the SPA.
- The enum rule outside the system model (`DesignDocViolationReason`,
  `ChangeType`, `ChangeStatus`, the parser settings' `Language`): the
  design documents' and the changes' business.
