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

const joinAddress = (...segments: string[]) =>
  segments.join(ELEMENT_ADDRESS_SEPARATOR);
const serialize = (kind: ElementKind, address: string) =>
  `${kind}${ELEMENT_KIND_SEPARATOR}${address}`;
const kindOf = (value: string) =>
  value.slice(0, value.indexOf(ELEMENT_KIND_SEPARATOR));
const addressOf = (value: string) =>
  value.slice(value.indexOf(ELEMENT_KIND_SEPARATOR) + 1);
const segmentsOf = (address: string) =>
  address.split(ELEMENT_ADDRESS_SEPARATOR);
const nameOf = (address: string) => segmentsOf(address).at(-1) ?? address;
const containerOf = (address: string) =>
  joinAddress(...segmentsOf(address).slice(0, -1));

function checkName(name: string): Result<string, VoIssue[]> {
  return ELEMENT_NAME_PATTERN.test(name)
    ? ok(name)
    : fail(
        `Not an element name: ${JSON.stringify(name)}. A name is never empty, never padded with whitespace, and never contains '.' or '|'.`,
      );
}

export class ModuleId {
  static readonly PATTERN = idPattern(0, ['module']);

  readonly kind = 'module' as const;

  private constructor(readonly value: string) {}

  static tryCreate(value: string): Result<ModuleId, VoIssue[]> {
    if (!ModuleId.PATTERN.test(value)) {
      return fail(
        `Not a module id: ${JSON.stringify(value)}. Expected 'module|', then names joined by '.', e.g. 'module|sales.orders'.`,
      );
    }
    return ok(new ModuleId(value));
  }

  /** Trusted input only: tests, constants, already-validated data. */
  static create(value: string): ModuleId {
    return unwrap('ModuleId', ModuleId.tryCreate(value));
  }

  /** A module with no parent. */
  static tryRoot(name: string): Result<ModuleId, VoIssue[]> {
    return checkName(name).andThen((n) =>
      ModuleId.tryCreate(serialize('module', n)),
    );
  }

  static root(name: string): ModuleId {
    return unwrap('ModuleId', ModuleId.tryRoot(name));
  }

  static readonly schema = voCodec(
    z
      .string()
      .regex(ModuleId.PATTERN)
      .describe(
        "A module's id: 'module|{L1Name}', 'module|{L1Name}.{L2Name}', … to any depth, because modules nest.",
      ),
    ModuleId,
    (value) => ModuleId.tryCreate(value),
    (id) => id.value,
  );

  /** The id without its kind: `sales.orders`. */
  get address(): string {
    return addressOf(this.value);
  }

  get name(): string {
    return nameOf(this.address);
  }

  /** The module this one nests in; null for a root module. */
  get parent(): ModuleId | null {
    const container = containerOf(this.address);
    return container === ''
      ? null
      : ModuleId.create(serialize('module', container));
  }

  /** A module nested in this one. */
  tryChild(name: string): Result<ModuleId, VoIssue[]> {
    return checkName(name).andThen((n) =>
      ModuleId.tryCreate(serialize('module', joinAddress(this.address, n))),
    );
  }

  child(name: string): ModuleId {
    return unwrap('ModuleId', this.tryChild(name));
  }

  /** A building block living in this module. */
  tryBuildingBlock(name: string): Result<BuildingBlockId, VoIssue[]> {
    return checkName(name).andThen((n) =>
      BuildingBlockId.tryCreate(
        serialize('building_block', joinAddress(this.address, n)),
      ),
    );
  }

  buildingBlock(name: string): BuildingBlockId {
    return unwrap('BuildingBlockId', this.tryBuildingBlock(name));
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

export class BuildingBlockId {
  static readonly PATTERN = idPattern(1, ['building_block']);

  readonly kind = 'building_block' as const;

  private constructor(readonly value: string) {}

  static tryCreate(value: string): Result<BuildingBlockId, VoIssue[]> {
    if (!BuildingBlockId.PATTERN.test(value)) {
      return fail(
        `Not a building block id: ${JSON.stringify(value)}. Expected 'building_block|', then its module's address, then its name, e.g. 'building_block|sales.orders.Refund'.`,
      );
    }
    return ok(new BuildingBlockId(value));
  }

  /** Trusted input only: tests, constants, already-validated data. */
  static create(value: string): BuildingBlockId {
    return unwrap('BuildingBlockId', BuildingBlockId.tryCreate(value));
  }

  static readonly schema = voCodec(
    z
      .string()
      .regex(BuildingBlockId.PATTERN)
      .describe(
        "A building block's id: 'building_block|', then its module's address, then its name.",
      ),
    BuildingBlockId,
    (value) => BuildingBlockId.tryCreate(value),
    (id) => id.value,
  );

  /** The id without its kind: `sales.orders.Refund`. */
  get address(): string {
    return addressOf(this.value);
  }

  get name(): string {
    return nameOf(this.address);
  }

  /** The module this building block lives in. */
  get module(): ModuleId {
    return ModuleId.create(serialize('module', containerOf(this.address)));
  }

  /** A behavior of this building block. */
  tryBehavior(name: string): Result<BehaviorId, VoIssue[]> {
    return checkName(name).andThen((n) =>
      BehaviorId.tryCreate(serialize('behavior', joinAddress(this.address, n))),
    );
  }

  behavior(name: string): BehaviorId {
    return unwrap('BehaviorId', this.tryBehavior(name));
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

export class BehaviorId {
  static readonly PATTERN = idPattern(2, ['behavior']);

  readonly kind = 'behavior' as const;

  private constructor(readonly value: string) {}

  static tryCreate(value: string): Result<BehaviorId, VoIssue[]> {
    if (!BehaviorId.PATTERN.test(value)) {
      return fail(
        `Not a behavior id: ${JSON.stringify(value)}. Expected 'behavior|', then its building block's address, then its name, e.g. 'behavior|sales.orders.Refund.issue'.`,
      );
    }
    return ok(new BehaviorId(value));
  }

  /** Trusted input only: tests, constants, already-validated data. */
  static create(value: string): BehaviorId {
    return unwrap('BehaviorId', BehaviorId.tryCreate(value));
  }

  static readonly schema = voCodec(
    z
      .string()
      .regex(BehaviorId.PATTERN)
      .describe(
        "A behavior's id: 'behavior|', then its building block's address, then its name.",
      ),
    BehaviorId,
    (value) => BehaviorId.tryCreate(value),
    (id) => id.value,
  );

  /** The id without its kind: `sales.orders.Refund.issue`. */
  get address(): string {
    return addressOf(this.value);
  }

  get name(): string {
    return nameOf(this.address);
  }

  /** The building block this behavior belongs to. */
  get buildingBlock(): BuildingBlockId {
    return BuildingBlockId.create(
      serialize('building_block', containerOf(this.address)),
    );
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
