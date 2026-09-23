---
name: value-objects
description: Create and use value objects (VOs) — domain primitives such as ids, names, slugs and quantities — as branded Zod schemas with factories. Use whenever you need a type for a domain primitive, or code that takes, builds or checks one.
---

# Value Objects as branded Zod schemas

A VO is a **branded Zod schema** plus the **functions** that build and read its values. At runtime the value is the primitive itself: a string stays a string. The brand exists only for the type checker, so a `ModuleId` cannot be passed where a `BuildingBlockId` is expected, and no plain string becomes a `ModuleId` without passing the schema.

The reference implementation is `server/backend/src/app/element-id.ts`. Read it before you write a VO, and copy its shape.

## Why this shape

- The schema holds every rule, and every rule is declarative (`regex`, `min`, `max`, `int`, enum). The JSON Schema an agent reads is generated from it, so it states every rule. Under `src/app/` a refinement or transform is refused (`test/unit/contracts-json-schema.spec.ts`), because JSON Schema would drop it silently.
- The wire form and the domain form are the same value. No codec, no `encode`, no mapping to JSON. `JSON.stringify` and `z.encode` give the wire value unchanged.
- Equality is `===`. Values work as `Map` keys and `Set` members, and `toEqual` compares them.

## Write the VO

```ts
import { z } from 'zod';

const MODULE_KIND = 'module';
const moduleIdSchema = z
  .string()
  .regex(idPattern(MODULE_KIND, 0), 'Invalid ModuleId')
  .describe("A module's id: 'module|{L1Name}', 'module|{L1Name}.{L2Name}', … to any depth.")
  .brand<'ModuleId'>();

export const ModuleId = Object.assign(moduleIdSchema, {
  root: (name: string) => moduleIdSchema.parse(`${MODULE_KIND}|${ElementName.parse(name)}`),
  within: (parent: ModuleId, name: string) =>
    moduleIdSchema.parse(`${MODULE_KIND}|${childPath(parent, name)}`),
  containing: (id: BuildingBlockId | BehaviorId) => {
    /* … */
  },
  parentOf: (id: ModuleId) => {
    /* … returns null for a root module */
  },
});
export type ModuleId = z.infer<typeof moduleIdSchema>;

// … the other VO blocks, then the private helpers.
```

Rules:

- **One name for the schema and the type.** Keep the schema in a private `xSchema` const. Export `X = Object.assign(xSchema, {...})` and `type X = z.infer<typeof xSchema>`. Infer the type from `xSchema`, never from `X`: the functions inside `Object.assign` use the type `X`, so `typeof X` is circular and silently `any`. For the same reason, functions inside call `xSchema.parse`, not `X.parse`.
- **Public API first, dependencies after.** Each VO reads as one block: its private `xSchema`, then `export const X`, then `export type X`. The schema must come before the export, because the export reads it while the module loads. The VO blocks come first, in the order a reader needs them. Private helpers follow, as `function` declarations: they are hoisted, so the VOs and schemas may call them. A `const` is not hoisted, so a value the schemas read while loading and that several VOs share (a regex source such as `NAME_REGEX`, or a pattern builder such as `idPattern`) goes at the top of the file as a `const`, before the VO blocks.
- **Rules in the schema only.** Chain `.regex`/`.min`/`.max`/… then `.describe(...)` for the agent, then `.brand<'X'>()` last. Put a message on the rule that says what is wrong (`'Invalid ModuleId'`).
- **Name a literal the VO repeats.** A kind or prefix used by the pattern, the factories and the guards is a private `const` in the VO's block, just above its schema (`MODULE_KIND`), so the schema can read it while the module loads.
- **Keep private what nothing else needs.** Share a pattern between VOs of one file through a private function, not an export.
- **A part with its own rules is its own schema.** A factory that builds a value from parts parses each part with the part's schema (`ElementName.parse(name)`) before it builds the whole. Otherwise a part can smuggle a separator in, and the whole still matches the pattern (`within(module, 'x.y')` would nest one level too deep).
- **A schema with no behaviour stays unbranded.** A name that is only checked, never built or navigated, is a plain `z.string()` schema with the same one-name rule (`ElementName`).
- **Factories and operations are functions** in the `Object.assign` object. Write them in place as arrow functions. Do not overload them: an object literal cannot declare overloads without a cast. When one input kind has a different result type, give it its own function (`ModuleId.parentOf(module): ModuleId | null` beside `ModuleId.containing(blockOrBehavior): ModuleId`):
  - A named factory (`root`, `within`, `fromTitle`) builds the value and ends in `xSchema.parse(...)`. It never casts.
  - Name the direction: `within(parent, name)` builds downward, `containing(id)` looks upward to a container of another kind, and `parentOf(id)` to the parent of the same kind. Keep these words across every VO of a family.
  - A lookup lives on the VO it returns and accepts every kind it can answer for, so callers never chain: `ModuleId.containing(buildingBlockId)` and `ModuleId.containing(behaviorId)`, not `ModuleId.containing(BuildingBlockId.containing(behaviorId))`.
  - An operation takes the value first and returns a VO through its schema's `parse`.
  - An operation shared by several kinds of VO goes on their union: `ElementId.nameOf(id)`.
- **Kinds of one family:** a private `z.union([...])` of the member schemas, exported through `Object.assign` like any VO, with the shared operations, `isX` type guards on a prefix or other cheap check, and an exhaustive `match(value, { … })`: `ElementId.isModule(id)`, `ElementId.match(id, { module, buildingBlock, behavior })`.
- **Synchronous, no I/O.** Uniqueness and existence checks belong in services.
- **Never** `as X` outside tests, `class` VOs, `z.codec`, `.transform()`, `.refine()`, or an `equals` method.

## Build, check and use a value

| Need                          | Call                                                                       |
| ----------------------------- | -------------------------------------------------------------------------- |
| Trusted input, or throw       | `X.parse(value)` (throws `ZodError`)                                       |
| Untrusted input, no exception | `X.safeParse(value)`; read `.data` after `.success`, map `.error` issues   |
| Build from parts              | the factory: `ModuleId.within(parent, 'orders')`                               |
| Wire type / domain type       | `z.input<typeof Dto>` is the plain JSON; `z.output<typeof Dto>` is branded |
| JSON Schema of a DTO          | `z.toJSONSchema(Dto, { io: 'input' })`                                     |

- VOs compose like any schema: `z.object({ id: ModuleId })`, `z.array(BuildingBlockId)`, `ModuleId.nullable()`.
- **Inbound** (HTTP body, MCP arguments, file, env): `Dto.safeParse(x)`. This is where validation happens. After it, code takes and returns VO types, not `string`.
- **Outbound** (response, file write, `structuredContent`): the value is already its JSON. Pass it as it is.
- Name both DTO types when both are used: `z.infer` is the output type, and it is easy to misuse as the request-body type.

## Test (bun:test)

`test/unit/element-id.spec.ts` is the reference. Per VO:

- The schema accepts every valid shape and rejects each broken one (`it.each` over bad values).
- Each factory gives the value you would write by hand (`expect(ModuleId.root('sales')).toBe(ModuleId.parse('module|sales'))`) and throws `z.ZodError` on a bad part.
- Each operation, including its edge (`ModuleId.parentOf` a root module is `null`).
- Inside a DTO, a bad value is reported at its path (`['elements', 1]`), and `z.encode(Dto, Dto.parse(wire))` equals `wire`.
- `z.toJSONSchema(X, { io: 'input' })` advertises the pattern.

## Checklist

- [ ] Private `xSchema` with declarative rules, `.describe`, `.brand` last
- [ ] `export const X = Object.assign(xSchema, {...})`, `export type X = z.infer<typeof xSchema>`
- [ ] Each VO as one block (`xSchema`, `X`, `type X`); VO blocks first, private helpers after as `function` declarations
- [ ] Factories parse every part with its own schema, then end in `xSchema.parse`
- [ ] No class, codec, transform, refine, `equals` or cast
- [ ] Boundaries `safeParse` in; values go out as they are
- [ ] Tests: accept/reject, factories, operations, DTO path, JSON Schema
