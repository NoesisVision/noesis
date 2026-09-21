import { describe, expect, it } from 'bun:test';
import { err, ok, type Result } from 'neverthrow';
import { z } from 'zod';
import {
  fail,
  failAll,
  unwrap,
  ValueObjectError,
  voCodec,
  voInstance,
  type VoIssue,
} from '#backend/app/vo';

/*
 * Two sample value objects, written exactly as the value-objects skill says
 * a VO is written. `Email` wraps one string; `Money` wraps an object and
 * reports issues at a field path.
 */

class Email {
  private constructor(readonly value: string) {}

  static tryCreate(raw: string): Result<Email, VoIssue[]> {
    const v = raw.trim().toLowerCase();
    if (v.length > 254) return fail('Email is too long');
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v)) {
      return fail('Email has invalid format');
    }
    return ok(new Email(v));
  }

  static create(raw: string): Email {
    return unwrap('Email', Email.tryCreate(raw));
  }

  static readonly schema = voCodec(
    z.string(),
    Email,
    (raw) => Email.tryCreate(raw),
    (email) => email.value,
  );

  equals(other: Email): boolean {
    return this.value === other.value;
  }
}

const CURRENCIES = ['USD', 'EUR'] as const;
type Currency = (typeof CURRENCIES)[number];

class Money {
  private constructor(
    readonly amount: number,
    readonly currency: Currency,
  ) {}

  static tryCreate(w: {
    amount: number;
    currency: Currency;
  }): Result<Money, VoIssue[]> {
    if (!Number.isSafeInteger(w.amount)) {
      return fail('Amount must be an integer in minor units', ['amount']);
    }
    if (w.amount < 0) return fail('Amount cannot be negative', ['amount']);
    return ok(new Money(w.amount, w.currency));
  }

  static create(amount: number, currency: Currency): Money {
    return unwrap('Money', Money.tryCreate({ amount, currency }));
  }

  static readonly wire = z.object({
    amount: z.number(),
    currency: z.enum(CURRENCIES),
  });

  static readonly schema = voCodec(
    Money.wire,
    Money,
    (w) => Money.tryCreate(w),
    (m) => ({ amount: m.amount, currency: m.currency }),
  );

  tryAdd(other: Money): Result<Money, VoIssue[]> {
    if (other.currency !== this.currency) {
      return fail(`Currency mismatch: ${this.currency} vs ${other.currency}`, [
        'currency',
      ]);
    }
    return ok(new Money(this.amount + other.amount, this.currency));
  }

  add(other: Money): Money {
    return unwrap('Money', this.tryAdd(other));
  }
}

describe('fail and failAll', () => {
  it('fail is an Err of one issue, with or without a path', () => {
    expect(fail('bad')._unsafeUnwrapErr()).toEqual([
      { message: 'bad', path: undefined },
    ]);
    expect(fail('bad', ['amount'])._unsafeUnwrapErr()).toEqual([
      { message: 'bad', path: ['amount'] },
    ]);
  });

  it('failAll is an Err of the issues collected', () => {
    const issues = [{ message: 'a' }, { message: 'b', path: ['x'] }];
    expect(failAll(issues)._unsafeUnwrapErr()).toBe(issues);
  });
});

describe('unwrap', () => {
  it('returns the value of an Ok', () => {
    expect(unwrap('Email', ok(1))).toBe(1);
  });

  it('throws a ValueObjectError naming the VO, the field and the issue', () => {
    const result = fail('Amount cannot be negative', ['amount']);
    expect(() => unwrap('Money', result)).toThrow(ValueObjectError);
    try {
      unwrap('Money', result);
    } catch (e) {
      const error = e as ValueObjectError;
      expect(error.name).toBe('ValueObjectError');
      expect(error.voName).toBe('Money');
      expect(error.issues).toEqual([
        { message: 'Amount cannot be negative', path: ['amount'] },
      ]);
      expect(error.message).toBe(
        'Invalid Money: amount: Amount cannot be negative',
      );
    }
  });

  it('lists every issue in the error message', () => {
    const result = failAll([{ message: 'first' }, { message: 'second' }]);
    expect(() => unwrap('Thing', result)).toThrow(
      'Invalid Thing: first; second',
    );
  });
});

describe('a VO written with the helpers', () => {
  it('normalises in tryCreate, so equal inputs give equal VOs', () => {
    const a = Email.create('  Ann@Example.COM ');
    expect(a.value).toBe('ann@example.com');
    expect(a.equals(Email.create('ann@example.com'))).toBe(true);
  });

  it('create throws on bad input, tryCreate returns Err', () => {
    expect(Email.tryCreate('nope').isErr()).toBe(true);
    expect(() => Email.create('nope')).toThrow(
      'Invalid Email: Email has invalid format',
    );
  });

  it('a fallible operation has a Result form and a throwing form', () => {
    const usd = Money.create(100, 'USD');
    expect(usd.add(Money.create(50, 'USD')).amount).toBe(150);
    expect(usd.tryAdd(Money.create(1, 'EUR'))._unsafeUnwrapErr()).toEqual([
      { message: 'Currency mismatch: USD vs EUR', path: ['currency'] },
    ]);
    expect(() => usd.add(Money.create(1, 'EUR'))).toThrow(ValueObjectError);
  });
});

describe('voCodec', () => {
  it('decodes a wire value into an instance and encodes it back', () => {
    const email = Email.schema.parse('Ann@Example.com');
    expect(email).toBeInstanceOf(Email);
    expect(email.value).toBe('ann@example.com');
    expect(z.encode(Email.schema, email)).toBe('ann@example.com');

    const money = z.decode(Money.schema, { amount: 5, currency: 'EUR' });
    expect(money).toBeInstanceOf(Money);
    expect(z.encode(Money.schema, money)).toEqual({
      amount: 5,
      currency: 'EUR',
    });
  });

  it('types the input as the wire shape and the output as the VO', () => {
    const wire: z.input<typeof Money.schema> = { amount: 1, currency: 'USD' };
    const vo: z.output<typeof Money.schema> = Money.create(1, 'USD');
    expect(Money.schema.parse(wire).amount).toBe(1);
    expect(vo.amount).toBe(1);
  });

  it('rejects a wire value of the wrong shape before the factory runs', () => {
    const r = Email.schema.safeParse(42);
    expect(r.success).toBe(false);
    expect(r.error?.issues[0]?.code).toBe('invalid_type');
  });

  it('turns factory issues into Zod issues at the wire path', () => {
    const r = Money.schema.safeParse({ amount: -1, currency: 'USD' });
    expect(r.success).toBe(false);
    expect(r.error?.issues).toEqual([
      expect.objectContaining({
        code: 'custom',
        message: 'Amount cannot be negative',
        path: ['amount'],
      }),
    ]);
  });

  it('keeps the outer path when the VO sits inside a bigger schema', () => {
    const Dto = z.object({
      customer: Email.schema,
      lines: z.array(z.object({ price: Money.schema })),
    });
    const r = Dto.safeParse({
      customer: 'nope',
      lines: [
        { price: { amount: 1, currency: 'USD' } },
        { price: { amount: 1.5, currency: 'USD' } },
      ],
    });
    expect(r.success).toBe(false);
    expect(r.error?.issues.map((i) => [i.path, i.message])).toEqual([
      [['customer'], 'Email has invalid format'],
      [
        ['lines', 1, 'price', 'amount'],
        'Amount must be an integer in minor units',
      ],
    ]);
  });

  it('reports every issue the factory returns', () => {
    class Range {
      private constructor(
        readonly from: number,
        readonly to: number,
      ) {}

      static tryCreate(w: {
        from: number;
        to: number;
      }): Result<Range, VoIssue[]> {
        const issues: VoIssue[] = [];
        if (w.from < 0) issues.push({ message: 'from < 0', path: ['from'] });
        if (w.to < 0) issues.push({ message: 'to < 0', path: ['to'] });
        return issues.length ? failAll(issues) : ok(new Range(w.from, w.to));
      }

      static readonly schema = voCodec(
        z.object({ from: z.number(), to: z.number() }),
        Range,
        (w) => Range.tryCreate(w),
        (r) => ({ from: r.from, to: r.to }),
      );
    }

    const r = Range.schema.safeParse({ from: -1, to: -2 });
    expect(r.error?.issues.map((i) => i.path)).toEqual([['from'], ['to']]);
  });

  it('still fails when the factory returns an Err with no issues', () => {
    class Odd {
      private constructor() {}
      static readonly schema = voCodec(
        z.string(),
        Odd,
        () => err([]),
        () => '',
      );
    }
    const r = Odd.schema.safeParse('x');
    expect(r.success).toBe(false);
    expect(r.error?.issues.map((i) => i.message)).toEqual(['Invalid Odd']);
  });

  it('refuses to encode anything that is not an instance', () => {
    const r = z.safeEncode(Email.schema, 'ann@example.com' as unknown as Email);
    expect(r.success).toBe(false);
    expect(r.error?.issues[0]?.message).toBe('Expected an instance of Email');

    const nested = z.safeEncode(z.object({ price: Money.schema }), {
      price: { amount: 1, currency: 'USD' } as unknown as Money,
    });
    expect(nested.error?.issues[0]?.path).toEqual(['price']);
  });

  it('round-trips wire -> VO -> wire to the normalised wire value', () => {
    expect(z.encode(Email.schema, z.decode(Email.schema, ' A@B.io '))).toBe(
      'a@b.io',
    );
    const wire = { amount: 1999, currency: 'USD' as const };
    expect(z.encode(Money.schema, z.decode(Money.schema, wire))).toEqual(wire);
  });

  it('describes the wire shape as JSON Schema for the input side', () => {
    expect(z.toJSONSchema(Email.schema, { io: 'input' })).toMatchObject({
      type: 'string',
    });
    expect(z.toJSONSchema(Money.schema, { io: 'input' })).toMatchObject({
      type: 'object',
      required: ['amount', 'currency'],
    });
  });

  it('composes with optional, arrays and defaults like any schema', () => {
    const Dto = z.object({
      discount: Money.schema.optional(),
      emails: z.array(Email.schema).default([]),
    });
    const parsed = Dto.parse({});
    expect(parsed.discount).toBeUndefined();
    expect(parsed.emails).toEqual([]);
    expect(z.encode(Dto, parsed)).toEqual({ emails: [] });
  });
});

describe('voInstance', () => {
  const schema = voInstance(Email);

  it('accepts an instance and nothing else', () => {
    const email = Email.create('a@b.io');
    expect(schema.parse(email)).toBe(email);
    expect(schema.safeParse('a@b.io').success).toBe(false);
    expect(schema.safeParse({ value: 'a@b.io' }).success).toBe(false);
    expect(schema.safeParse(null).success).toBe(false);
  });

  it('names the expected class in the issue', () => {
    expect(schema.safeParse('x').error?.issues[0]?.message).toBe(
      'Expected an instance of Email',
    );
  });
});
