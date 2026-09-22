# Value Object examples

## Contents

1. Composite VO: `Money` (field paths, `wire` export, `tryX` operations)
2. Simple VO: `Quantity`
3. Request DTO composing VOs
4. Boundary: handler (parse → service returning `Result` → encode)
5. neverthrow combinators on VO factories
6. Tests (bun:test)

## 1. Composite VO: `Money`

Notice: `fail(..., ['amount'])` sets the error path, `static wire` is exported beside `schema`, `tryAdd`/`trySubtract` return `Result`, and `add` is the throwing twin built with `unwrap`.

```ts
import { ok, type Result } from 'neverthrow';
import { z } from 'zod';
import { fail, unwrap, voCodec, type VoIssue } from '#backend/app/vo';

export const CURRENCIES = ['USD', 'EUR', 'PLN'] as const;
export type Currency = (typeof CURRENCIES)[number];

export class Money {
  private constructor(
    /** Amount in minor units (cents). */
    readonly amount: number,
    readonly currency: Currency,
  ) {}

  static tryCreate(w: { amount: number; currency: Currency }): Result<Money, VoIssue[]> {
    if (!Number.isSafeInteger(w.amount)) {
      return fail('Amount must be an integer in minor units', ['amount']);
    }
    if (w.amount < 0) return fail('Amount cannot be negative', ['amount']);
    return ok(new Money(w.amount, w.currency));
  }

  static create(amount: number, currency: Currency): Money {
    return unwrap('Money', Money.tryCreate({ amount, currency }));
  }

  /** Invariants trivially hold, so the constructor is fine here. */
  static zero(currency: Currency): Money {
    return new Money(0, currency);
  }

  /** Advertises the cheap rules; tryCreate re-checks them. Exported for .extend()/.pick(). */
  static readonly wire = z.object({
    amount: z.int().nonnegative(),
    currency: z.enum(CURRENCIES),
  });

  static readonly schema = voCodec(
    Money.wire,
    Money,
    (w) => Money.tryCreate(w),
    (m) => ({ amount: m.amount, currency: m.currency }),
  );

  /** Err instead of throwing on currency mismatch. */
  tryAdd(other: Money): Result<Money, VoIssue[]> {
    if (other.currency !== this.currency) {
      return fail(`Currency mismatch: ${this.currency} vs ${other.currency}`, ['currency']);
    }
    return ok(new Money(this.amount + other.amount, this.currency));
  }

  /** Err on currency mismatch or when the result would be negative. */
  trySubtract(other: Money): Result<Money, VoIssue[]> {
    if (other.currency !== this.currency) {
      return fail(`Currency mismatch: ${this.currency} vs ${other.currency}`, ['currency']);
    }
    return Money.tryCreate({ amount: this.amount - other.amount, currency: this.currency });
  }

  /** Throwing twin, for code paths where same currency is already guaranteed. */
  add(other: Money): Money {
    return unwrap('Money', this.tryAdd(other));
  }

  multiply(factor: number): Money {
    return Money.create(Math.round(this.amount * factor), this.currency);
  }

  equals(other: Money): boolean {
    return this.amount === other.amount && this.currency === other.currency;
  }
}
```

## 2. Simple VO: `Quantity`

```ts
import { ok, type Result } from 'neverthrow';
import { z } from 'zod';
import { fail, unwrap, voCodec, type VoIssue } from '#backend/app/vo';

export class Quantity {
  private constructor(readonly value: number) {}

  static tryCreate(n: number): Result<Quantity, VoIssue[]> {
    if (!Number.isInteger(n) || n < 1) return fail('Quantity must be a positive integer');
    if (n > 999) return fail('Quantity cannot exceed 999');
    return ok(new Quantity(n));
  }

  static create(n: number): Quantity {
    return unwrap('Quantity', Quantity.tryCreate(n));
  }

  static readonly schema = voCodec(
    z.int().min(1).max(999),
    Quantity,
    (n) => Quantity.tryCreate(n),
    (q) => q.value,
  );

  tryAdd(other: Quantity): Result<Quantity, VoIssue[]> {
    return Quantity.tryCreate(this.value + other.value);
  }

  equals(other: Quantity): boolean {
    return this.value === other.value;
  }
}
```

## 3. Request DTO composing VOs

```ts
import { z } from 'zod';

/** VO codecs compose like any other schema. */
export const OrderLineDto = z.object({
  sku: z.string().min(1),
  unitPrice: Money.schema,
  quantity: Quantity.schema,
});

export const CreateOrderDto = z.object({
  customerEmail: Email.schema,
  lines: z.array(OrderLineDto).min(1),
  discount: Money.schema.optional(),
});

/** What arrives over the wire (plain JSON). */
export type CreateOrderInput = z.input<typeof CreateOrderDto>;
/** What the application layer receives (VO instances). */
export type CreateOrderCommand = z.output<typeof CreateOrderDto>;
```

## 4. Boundary: handler

Framework-agnostic; adapt `HttpResponse` to a Hono route or an MCP tool. The pattern:

- `safeParse` → 400 on structural or VO errors
- the service returns `Result` → 422 on business errors
- `z.encode` for the response

```ts
import { ok, type Result } from 'neverthrow';
import { z } from 'zod';
import { type VoIssue } from '#backend/app/vo';

// ---- Response DTO: same VO codecs, used in the encode direction ----
export const OrderResponseDto = z.object({
  customerEmail: Email.schema,
  total: Money.schema,
  lineCount: z.number(),
});
type OrderResponse = z.output<typeof OrderResponseDto>;

// ---- Service: works only with VOs, returns Result ----
function placeOrder(cmd: CreateOrderCommand): Result<OrderResponse, VoIssue[]> {
  const subtotal = cmd.lines.reduce<Result<Money, VoIssue[]>>(
    (acc, l) => acc.andThen((sum) => sum.tryAdd(l.unitPrice.multiply(l.quantity.value))),
    ok(Money.zero(cmd.lines[0]?.unitPrice.currency ?? 'USD')),
  );

  return subtotal
    .andThen((s) => (cmd.discount ? s.trySubtract(cmd.discount) : ok(s)))
    .map((total) => ({ customerEmail: cmd.customerEmail, total, lineCount: cmd.lines.length }));
}

// ---- Boundary: parse in -> domain -> encode out ----
type HttpResponse = { status: number; body: unknown };

export function createOrderHandler(body: unknown): HttpResponse {
  const parsed = CreateOrderDto.safeParse(body);
  if (!parsed.success) {
    return { status: 400, body: { errors: z.flattenError(parsed.error).fieldErrors } };
  }

  return placeOrder(parsed.data).match(
    (order) => ({ status: 201, body: z.encode(OrderResponseDto, order) }),
    (issues) => ({ status: 422, body: { errors: issues } }),
  );
}
```

Observed responses:

```
valid, discount 500      → 201 {"customerEmail":"a@b.io","total":{"amount":1500,"currency":"USD"},"lineCount":1}
bad email, empty lines   → 400 {"errors":{"customerEmail":["Email has invalid format"],"lines":["Too small: ..."]}}
mixed currencies         → 422 {"errors":[{"message":"Currency mismatch: USD vs EUR","path":["currency"]}]}
discount > subtotal      → 422 {"errors":[{"message":"Amount cannot be negative","path":["amount"]}]}
```

## 5. neverthrow combinators on VO factories

```ts
import { Result } from 'neverthrow';

// map + unwrapOr
const domain = Email.tryCreate(input).map((e) => e.domain).unwrapOr('unknown');

// andThen: the first Err short-circuits
const sum = Money.tryCreate({ amount: 100, currency: 'USD' }).andThen((a) =>
  Money.tryCreate({ amount: 250, currency: 'EUR' }).andThen((b) => a.tryAdd(b)),
);
// -> Err([{ message: 'Currency mismatch: USD vs EUR', path: ['currency'] }])

// Validate several VOs at once and collect all issues (Err type is VoIssue[][], so flatten)
const all = Result.combineWithAllErrors([Email.tryCreate(a), Email.tryCreate(b)]).mapErr((e) => e.flat());

// match to leave Result-land
const label = sum.match(
  (m) => `${m.amount} ${m.currency}`,
  (issues) => issues[0]?.message ?? 'invalid',
);
```

## 6. Tests (bun:test)

```ts
import { describe, expect, it } from 'bun:test';
import { z } from 'zod';

describe('Money', () => {
  describe('tryCreate', () => {
    it('accepts integer minor units', () => {
      expect(Money.tryCreate({ amount: 1999, currency: 'USD' }).isOk()).toBe(true);
    });

    it.each([10.5, -1, Number.MAX_SAFE_INTEGER + 1])('rejects amount %s at path amount', (amount) => {
      const r = Money.tryCreate({ amount, currency: 'USD' });
      expect(r.isErr() && r.error.map((i) => i.path)).toEqual([['amount']]);
    });
  });

  describe('behavior', () => {
    it('adds same currency', () => {
      expect(Money.create(100, 'USD').add(Money.create(50, 'USD')).equals(Money.create(150, 'USD'))).toBe(true);
    });

    it('returns Err on currency mismatch', () => {
      expect(Money.create(1, 'USD').tryAdd(Money.create(1, 'EUR')).isErr()).toBe(true);
    });
  });

  describe('schema', () => {
    it('round-trips wire -> VO -> wire', () => {
      const wire = { amount: 1999, currency: 'USD' as const };
      expect(z.encode(Money.schema, z.decode(Money.schema, wire))).toEqual(wire);
    });

    it('reports errors at the right path, from the wire or the factory', () => {
      const r = Money.schema.safeParse({ amount: 1.5, currency: 'USD' });
      expect(r.success).toBe(false);
      expect(r.error?.issues[0]?.path).toEqual(['amount']);
    });
  });
});
```
