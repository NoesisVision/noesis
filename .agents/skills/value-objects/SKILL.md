---
name: value-objects
description: Create and use Value Object (VO) classes. Use whenever you need to create type for domain primitive (some Id, Email, Quantity, DateRange) or use such type.
---

# Value Objects with Zod

A VO is an immutable class that wraps one or more primitives and, once you hold an instance, is valid. Its rules live in **one place** (`tryCreate`), it exposes a Zod **codec** so any schema can use it, and validation happens only at **boundaries**. After a boundary, code works with typed instances instead of re-checking primitives.

## Helper

Import from `#backend/app/vo`. Do not copy it.

| Export                                    | Purpose                                                                                                   |
| ----------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| `VoIssue`                                 | `{ message; path? }`, the error element of every VO `Result`                                              |
| `fail(msg, path?)`                        | `Err` of one issue                                                                                        |
| `failAll(issues)`                         | `Err` of several issues collected at once                                                                 |
| `unwrap(voName, result)`                  | value, or throws `ValueObjectError` (`voName`, `issues`, message `Invalid Money: amount: ...`)            |
| `voCodec(wire, Class, decode, encode)`    | Zod codec wire ↔ instance; `Err` issues become Zod issues at the right path, encode refuses a non-instance |
| `voInstance(Class)`                       | schema accepting only existing instances (use instead of `z.instanceof`, which rejects private constructors) |

## Write the VO

```ts
import { ok, type Result } from 'neverthrow';
import { z } from 'zod';
import { fail, unwrap, voCodec, type VoIssue } from '#backend/app/vo';

export class Email {
  private constructor(readonly value: string) {}

  /** Single source of truth: normalize, then check every rule. */
  static tryCreate(raw: string): Result<Email, VoIssue[]> {
    const v = raw.trim().toLowerCase();
    if (v.length > 254) return fail('Email is too long');
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v)) return fail('Email has invalid format');
    return ok(new Email(v));
  }

  /** Trusted input only: tests, constants, already-validated data. */
  static create(raw: string): Email {
    return unwrap('Email', Email.tryCreate(raw));
  }

  static readonly schema = voCodec(
    z.string().max(254), // shape plus rules worth advertising; tryCreate re-checks
    Email,
    (raw) => Email.tryCreate(raw),
    (email) => email.value,
  );

  get domain(): string {
    return this.value.slice(this.value.indexOf('@') + 1);
  }

  equals(other: Email): boolean {
    return this.value === other.value;
  }
}
```

Rules:

- `private constructor`, `readonly` fields; operations return new instances. Only named factories whose invariants trivially hold (`Money.zero`) may call the constructor; everything else goes through `tryCreate`.
- Normalize before validating, so equal inputs give equal VOs.
- Multi-field VO: pass a path, `fail('Amount must be an integer', ['amount'])`, so Zod reports `lines.0.unitPrice.amount`. To report several rules at once, collect `VoIssue[]` and return `failAll(issues)`. Export `static readonly wire = z.object({...})` too, because a codec cannot be `.extend()`ed or `.pick()`ed.
- The wire schema (first argument of `voCodec`) states the shape plus the rules worth advertising in JSON Schema and cheap to state (`max`, `regex`, enum), since MCP clients and the frontend read that schema. `tryCreate` still holds and re-checks every rule: it is the truth, the wire is the advertisement. No normalization and nothing hard to state on the wire side.
- `encode` returns exactly what `decode` accepts, so round-trips are lossless.
- Put behavior on the VO and always implement `equals`. An operation that can fail on valid instances is `tryX(): Result<Vo, VoIssue[]>`; a throwing twin is `unwrap('Vo', this.tryX(...))`.
- Synchronous, no I/O. Uniqueness and existence checks belong in services.
- No ad-hoc `.transform()`, no `z.instanceof(Vo)`.

## Compose and use at boundaries

```ts
export const CreateOrderDto = z.object({
  customerEmail: Email.schema,
  lines: z.array(z.object({ unitPrice: Money.schema, quantity: Quantity.schema })).min(1),
});
export type CreateOrderInput = z.input<typeof CreateOrderDto>; // wire / JSON
export type CreateOrderCommand = z.output<typeof CreateOrderDto>; // VO instances
```

Name both types. `z.infer` is the output type and is easy to misuse as the request-body type.

- Inbound (HTTP body, MCP arguments, file, env): `Dto.safeParse(x)`, map `error` with `z.flattenError`. The only place validation happens.
- Outbound (response, file write, `structuredContent`): `z.encode(Dto, value)`. Never hand-map VOs to JSON.
- Domain and services take and return VO types, not the primitives they wrap.
- `Result`: use `map`, `andThen`, `match`, `unwrapOr`, `Result.combineWithAllErrors` (then `.mapErr((e) => e.flat())`). Read `.value`/`.error` only after `isOk()`/`isErr()`. `_unsafeUnwrap*` in tests only.
- JSON Schema of the wire side: `z.toJSONSchema(Dto, { io: 'input' })`.

## Test (bun:test)

Per VO: `tryCreate` valid (incl. normalization) and invalid (message, and path for composites); every `tryX` Err branch; round-trip `z.encode(Vo.schema, z.decode(Vo.schema, wire))` equals normalized `wire`; `Vo.schema.safeParse(bad)` issue at the expected path. `test/unit/vo.spec.ts` shows each of these against the helper.

## Checklist

- [ ] `private constructor`, `readonly`, no mutation
- [ ] `tryCreate` normalizes and holds every rule; `create` only gets trusted input
- [ ] `schema` via `voCodec`, wire advertises rules but `tryCreate` holds them, object VOs export `wire`
- [ ] `equals`; fallible operations return `Result`
- [ ] DTOs export named `z.input` / `z.output` types; boundaries `safeParse` in, `encode` out
- [ ] Tests: factory, behavior, round-trip, error path

`references/examples.md`: composite `Money` (paths, `wire`, `tryAdd`/`add`), a DTO, a handler (parse → service returning `Result` → encode), neverthrow combinators, and a test file. Read it for a multi-field VO, a boundary, or tests.
