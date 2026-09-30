import type { BuildingBlockId } from '#backend/app/element-id';
import {
  type BuildingBlockRef,
  PrimitiveId,
} from '#backend/app/system-model/system-model';

/*
 * A Java type as written (`Option<List<Weather>>`, `int[]`, `String...`)
 * resolved to what the model can reference: a building block by its simple
 * name, one of the model's primitives, or a collection of either. Anything
 * else — a wildcard, a map, a JDK class the model has no word for — resolves
 * to nothing and the caller leaves it out.
 */

/** A type expression: a simple name, its type arguments and whether it is an array. */
export interface TypeText {
  name: string;
  args: TypeText[];
  array: boolean;
}

export interface ResolvedType {
  ref: BuildingBlockRef;
  /** Whether the type was wrapped in `Optional` or `Option`. */
  optional: boolean;
}

/** What names a building block by simple name; null when nothing does. */
export type BlockLookup = (simpleName: string) => BuildingBlockId | null;

const COLLECTIONS = new Set([
  'List',
  'ArrayList',
  'LinkedList',
  'Set',
  'HashSet',
  'SortedSet',
  'TreeSet',
  'Collection',
  'Iterable',
  'Iterator',
  'Stream',
  'Seq',
  'Vector',
  'Queue',
  'Deque',
  'Array',
  'Traversable',
]);

const OPTIONALS = new Set(['Optional', 'Option']);

const PRIMITIVES: Readonly<Record<string, string>> = {
  boolean: 'boolean',
  Boolean: 'boolean',
  int: 'integer',
  Integer: 'integer',
  long: 'integer',
  Long: 'integer',
  short: 'integer',
  Short: 'integer',
  byte: 'integer',
  Byte: 'integer',
  BigInteger: 'integer',
  double: 'decimal',
  Double: 'decimal',
  float: 'decimal',
  Float: 'decimal',
  BigDecimal: 'decimal',
  String: 'string',
  CharSequence: 'string',
  char: 'string',
  Character: 'string',
  UUID: 'uuid',
  LocalDate: 'date',
  LocalDateTime: 'datetime',
  Instant: 'datetime',
  ZonedDateTime: 'datetime',
  OffsetDateTime: 'datetime',
  Date: 'datetime',
  Duration: 'duration',
  Period: 'duration',
};

/** The type expression `raw` writes, or null when it is not one (`?`, `void`). */
export function parseTypeText(raw: string): TypeText | null {
  let text = raw.trim();
  if (text === '' || text === 'void') return null;
  let array = false;
  if (text.endsWith('...')) {
    array = true;
    text = text.slice(0, -3).trim();
  }
  while (text.endsWith('[]')) {
    array = true;
    text = text.slice(0, -2).trim();
  }
  const bound = /^\?\s+(?:extends|super)\s+/.exec(text);
  if (bound) text = text.slice(bound[0].length);
  if (text === '?') return null;
  const open = text.indexOf('<');
  const qualified = open === -1 ? text : text.slice(0, open);
  const name = qualified.slice(qualified.lastIndexOf('.') + 1).trim();
  if (!/^\w+$/.test(name)) return null;
  const args =
    open === -1
      ? []
      : splitArguments(text.slice(open + 1, text.lastIndexOf('>')))
          .map(parseTypeText)
          .filter((arg): arg is TypeText => arg !== null);
  return { name, args, array };
}

/** The type `raw` resolved against the model, or null when the model has no word for it. */
export function resolveType(
  raw: string,
  blocks: BlockLookup,
): ResolvedType | null {
  const type = parseTypeText(raw);
  return type === null ? null : resolve(type, blocks);
}

function resolve(type: TypeText, blocks: BlockLookup): ResolvedType | null {
  if (type.array) {
    const element = resolve({ ...type, array: false }, blocks);
    return element === null
      ? null
      : { ref: { collectionOf: element.ref }, optional: false };
  }
  const [argument] = type.args;
  if (COLLECTIONS.has(type.name)) {
    const element = argument === undefined ? null : resolve(argument, blocks);
    return element === null
      ? null
      : { ref: { collectionOf: element.ref }, optional: false };
  }
  if (OPTIONALS.has(type.name)) {
    const element = argument === undefined ? null : resolve(argument, blocks);
    return element === null ? null : { ...element, optional: true };
  }
  const primitive = PRIMITIVES[type.name];
  if (primitive !== undefined) {
    return {
      ref: PrimitiveId.parse(`primitive|${primitive}`),
      optional: false,
    };
  }
  const block = blocks(type.name);
  return block === null ? null : { ref: block, optional: false };
}

/** The type arguments of `<…>`, split at the commas outside nested `<…>`. */
function splitArguments(text: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let current = '';
  for (const ch of text) {
    if (ch === '<') depth++;
    else if (ch === '>') depth--;
    if (ch === ',' && depth === 0) {
      parts.push(current);
      current = '';
    } else {
      current += ch;
    }
  }
  parts.push(current);
  return parts;
}
