import { err, type Err, type Result } from 'neverthrow';
import { z } from 'zod';

export type VoIssue = { message: string; path?: PropertyKey[] };

/** `Err` of one issue: `fail('Amount cannot be negative', ['amount'])`. */
export function fail(
  message: string,
  path?: PropertyKey[],
): Err<never, VoIssue[]> {
  return err([{ message, path }]);
}

/** `Err` of several issues collected at once. */
export function failAll(issues: VoIssue[]): Err<never, VoIssue[]> {
  return err(issues);
}

function describe(issue: VoIssue): string {
  return issue.path?.length
    ? `${issue.path.map(String).join('.')}: ${issue.message}`
    : issue.message;
}

export class ValueObjectError extends Error {
  readonly voName: string;
  readonly issues: VoIssue[];

  constructor(voName: string, issues: VoIssue[]) {
    super(`Invalid ${voName}: ${issues.map(describe).join('; ')}`);
    this.name = 'ValueObjectError';
    this.voName = voName;
    this.issues = issues;
  }
}

/** The value of an `Ok`, or a thrown `ValueObjectError`. Use in `static create()` and throwing twins of `tryX`. */
export function unwrap<T>(voName: string, result: Result<T, VoIssue[]>): T {
  return result.match(
    (value) => value,
    (issues) => {
      throw new ValueObjectError(voName, issues);
    },
  );
}

/**
 * Any class, including one with a private constructor.
 * (`z.instanceof` rejects classes with private constructors at the type level.)
 */
type ClassOf<T> = Function & { prototype: T };

/**
 * Builds a Zod 4.1+ codec:  wire value  <->  VO instance.
 *
 *   voCodec(z.string(), Email, (raw) => Email.tryCreate(raw), (email) => email.value)
 *
 *   schema.parse(x) / z.decode(schema, x)   wire -> VO   (Err issues become ZodIssues)
 *   z.encode(schema, vo)                    VO   -> wire (refuses a non-instance)
 *   z.input<typeof schema>                  wire type
 *   z.output<typeof schema>                 VO type
 *
 * `wire` may state the rules worth advertising (max, regex); `decode` re-checks every rule.
 */
export function voCodec<W extends z.ZodType, VO>(
  wire: W,
  cls: ClassOf<VO>,
  decode: (wire: z.output<W>) => Result<VO, VoIssue[]>,
  encode: (vo: VO) => z.output<W>,
) {
  return z.codec(wire, voInstance(cls), {
    decode: (value, ctx) =>
      decode(value).match(
        (vo) => vo,
        (issues) => {
          if (issues.length === 0)
            issues = [{ message: `Invalid ${cls.name}` }];
          for (const issue of issues) {
            ctx.issues.push({
              code: 'custom',
              message: issue.message,
              path: issue.path,
              input: value,
            });
          }
          return z.NEVER;
        },
      ),
    encode,
  });
}

/** Schema accepting only already-constructed instances (for domain-internal validation). */
export function voInstance<VO>(cls: ClassOf<VO>) {
  return z.custom<VO>((v) => v instanceof cls, {
    message: `Expected an instance of ${cls.name}`,
  });
}
