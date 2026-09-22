import { ok, type Result } from 'neverthrow';
import { z } from 'zod';
import { fail, unwrap, voCodec, type VoIssue } from '#backend/app/vo';

export const ELEMENT_ADDRESS_SEPARATOR = '.';
export const ELEMENT_KIND_SEPARATOR = '|';

export const TESTABLE_ELEMENT_KINDS = ['building_block', 'behavior'] as const;
export const ELEMENT_KINDS = ['module', ...TESTABLE_ELEMENT_KINDS] as const;

export const ElementKindSchema = z.enum(ELEMENT_KINDS);
export type ElementKind = z.infer<typeof ElementKindSchema>;

export const TestableElementKindSchema = z.enum(TESTABLE_ELEMENT_KINDS);
export type TestableElementKind = z.infer<typeof TestableElementKindSchema>;

const NAME_SOURCE = String.raw`[^.|\s](?:[^.|]*[^.|\s])?`;

/** An address with at least `containersBelowRoot` containers before the name. */
const addressSource = (containersBelowRoot: number) =>
  `${NAME_SOURCE}(?:\\.${NAME_SOURCE}){${containersBelowRoot},}`;

const idPattern = (containersBelowRoot: number, kinds: readonly string[]) =>
  new RegExp(
    `^(?:${kinds.join('|')})\\|${addressSource(containersBelowRoot)}$`,
  );

export const ELEMENT_NAME_PATTERN = new RegExp(`^${NAME_SOURCE}$`);
export const ELEMENT_ID_PATTERN = idPattern(0, ELEMENT_KINDS);
export const TESTABLE_ELEMENT_ID_PATTERN = idPattern(1, TESTABLE_ELEMENT_KINDS);

/** A name has rules but no behavior, so it stays a string. */
export const ElementNameSchema = z
  .string()
  .regex(ELEMENT_NAME_PATTERN)
  .describe(
    "The name of a single element: never empty, never padded with whitespace, and never containing the separators '.' and '|'.",
  );

const serialize = (kind: ElementKind, address: string) =>
  `${kind}${ELEMENT_KIND_SEPARATOR}${address}`;
const kindOf = (value: string) =>
  value.slice(0, value.indexOf(ELEMENT_KIND_SEPARATOR));
const addressOf = (value: string) =>
  value.slice(value.indexOf(ELEMENT_KIND_SEPARATOR) + 1);
const segmentsOf = (address: string) =>
  address.split(ELEMENT_ADDRESS_SEPARATOR);

/**
 * What every id class shares: the immutable `kind|address` value, its parts
 * and the `create` twin of the class's own `tryCreate`.
 */
abstract class ElementIdBase<K extends ElementKind> {
  readonly kind: K;

  readonly value: string;

  protected constructor(kind: K, value: string) {
    this.kind = kind;
    this.value = value;
  }

  /** Trusted input only: tests, constants, already-validated data. */
  static create<T>(
    this: { name: string; tryCreate: (value: string) => Result<T, VoIssue[]> },
    value: string,
  ): T {
    return unwrap(this.name, this.tryCreate(value));
  }

  /** The id without its kind: `sales.orders.Refund`. */
  get address(): string {
    return addressOf(this.value);
  }

  get name(): string {
    return segmentsOf(this.address).at(-1) ?? this.address;
  }

  /** The address of the element this one lives in: '' for a root module. */
  protected get containerAddress(): string {
    return segmentsOf(this.address)
      .slice(0, -1)
      .join(ELEMENT_ADDRESS_SEPARATOR);
  }

  equals(other: ElementId): boolean {
    return other.value === this.value;
  }

  toString(): string {
    return this.value;
  }

  toJSON(): string {
    return this.value;
  }
}

/** `tryCreate` for one id class: its pattern, or an issue naming the value and the expected shape. */
function idParser<T>(
  kind: ElementKind,
  pattern: RegExp,
  make: (value: string) => T,
  expected: string,
) {
  const label = kind.replace('_', ' ');
  return (value: string): Result<T, VoIssue[]> =>
    pattern.test(value)
      ? ok(make(value))
      : fail(`Not a ${label} id: ${JSON.stringify(value)}. ${expected}`);
}

type IdClass<T> = Function & {
  prototype: T;
  PATTERN: RegExp;
  tryCreate: (value: string) => Result<T, VoIssue[]>;
};

/** The codec of one id class: its pattern on the wire, an instance in the domain. */
function idSchema<T extends ElementIdBase<ElementKind>>(
  cls: IdClass<T>,
  describe: string,
) {
  return voCodec(
    z.string().regex(cls.PATTERN).describe(describe),
    cls,
    cls.tryCreate,
    (id) => id.value,
  );
}

export class ModuleId extends ElementIdBase<'module'> {
  static readonly PATTERN = idPattern(0, ['module']);

  static readonly tryCreate = idParser(
    'module',
    ModuleId.PATTERN,
    (value) => new ModuleId(value),
    "Expected 'module|', then names joined by '.', e.g. 'module|sales.orders'.",
  );

  static readonly schema = idSchema(
    ModuleId,
    "A module's id: 'module|{L1Name}', 'module|{L1Name}.{L2Name}', … to any depth, because modules nest.",
  );

  private constructor(value: string) {
    super('module', value);
  }

  /** The module this one nests in; null for a root module. */
  get parent(): ModuleId | null {
    const container = this.containerAddress;
    return container === ''
      ? null
      : ModuleId.create(serialize('module', container));
  }
}

export class BuildingBlockId extends ElementIdBase<'building_block'> {
  static readonly PATTERN = idPattern(1, ['building_block']);

  static readonly tryCreate = idParser(
    'building_block',
    BuildingBlockId.PATTERN,
    (value) => new BuildingBlockId(value),
    "Expected 'building_block|', then its module's address, then its name, e.g. 'building_block|sales.orders.Refund'.",
  );

  static readonly schema = idSchema(
    BuildingBlockId,
    "A building block's id: 'building_block|', then its module's address, then its name.",
  );

  private constructor(value: string) {
    super('building_block', value);
  }

  /** The module this building block lives in. */
  get module(): ModuleId {
    return ModuleId.create(serialize('module', this.containerAddress));
  }
}

export class BehaviorId extends ElementIdBase<'behavior'> {
  static readonly PATTERN = idPattern(2, ['behavior']);

  static readonly tryCreate = idParser(
    'behavior',
    BehaviorId.PATTERN,
    (value) => new BehaviorId(value),
    "Expected 'behavior|', then its building block's address, then its name, e.g. 'behavior|sales.orders.Refund.issue'.",
  );

  static readonly schema = idSchema(
    BehaviorId,
    "A behavior's id: 'behavior|', then its building block's address, then its name.",
  );

  private constructor(value: string) {
    super('behavior', value);
  }

  /** The building block this behavior belongs to. */
  get buildingBlock(): BuildingBlockId {
    return BuildingBlockId.create(
      serialize('building_block', this.containerAddress),
    );
  }
}

export type TestableElementId = BuildingBlockId | BehaviorId;
export type ElementId = ModuleId | TestableElementId;

/** Any element's id, dispatched on the kind before `|`. */
export function tryCreateElementId(
  value: string,
): Result<ElementId, VoIssue[]> {
  switch (kindOf(value)) {
    case 'module':
      return ModuleId.tryCreate(value);
    case 'building_block':
      return BuildingBlockId.tryCreate(value);
    case 'behavior':
      return BehaviorId.tryCreate(value);
    default:
      return fail(
        `Not an element id: ${JSON.stringify(value)}. Expected one of ${ELEMENT_KINDS.join(', ')}, then '|' and an address.`,
      );
  }
}

export function createElementId(value: string): ElementId {
  return unwrap('ElementId', tryCreateElementId(value));
}

export function tryCreateTestableElementId(
  value: string,
): Result<TestableElementId, VoIssue[]> {
  return tryCreateElementId(value).andThen((id) =>
    id instanceof ModuleId
      ? fail(
          `Not a testable element id: ${JSON.stringify(value)}. A module is not testable; expected one of ${TESTABLE_ELEMENT_KINDS.join(', ')}.`,
        )
      : ok(id),
  );
}

export function createTestableElementId(value: string): TestableElementId {
  return unwrap('TestableElementId', tryCreateTestableElementId(value));
}

/** A codec over a union of id classes: the same wire, any of the instances. */
function elementIdCodec<T extends ElementId>(
  wire: z.ZodString,
  classes: readonly (Function & { prototype: T })[],
  tryCreate: (value: string) => Result<T, VoIssue[]>,
) {
  const instance = z.custom<T>((v) => classes.some((cls) => v instanceof cls), {
    message: `Expected an instance of ${classes.map((c) => c.name).join(' | ')}`,
  });
  return z.codec(wire, instance, {
    decode: (value, ctx) =>
      tryCreate(value).match(
        (id) => id,
        (issues) => {
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
    encode: (id) => id.value,
  });
}

export const TestableElementIdSchema = elementIdCodec(
  z
    .string()
    .regex(TESTABLE_ELEMENT_ID_PATTERN)
    .describe(
      "A testable element's id: its kind, one of 'building_block' or 'behavior', then '|' and its address.",
    ),
  [BuildingBlockId, BehaviorId],
  tryCreateTestableElementId,
);

export const ElementIdSchema = elementIdCodec(
  z
    .string()
    .regex(ELEMENT_ID_PATTERN)
    .describe(
      "An element's id: its kind, then '|', then its name and its containers' names joined by '.', outermost first, e.g. 'behavior|sales.orders.Refund.issue'.",
    ),
  [ModuleId, BuildingBlockId, BehaviorId],
  tryCreateElementId,
);
