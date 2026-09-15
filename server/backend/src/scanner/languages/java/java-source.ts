import type { DesignedBuildingBlockType } from '@repo/shared-contracts';

/*
 * Extraction from one Java source file, regular expressions over a
 * comment-free copy of the text. The scanner is primitive on purpose: it
 * finds type declarations, the stereotype annotations on them and their
 * public methods, and leaves relations between types to the deeper scanners
 * (scanners/java on ArchUnit). Every transformation of the text replaces
 * characters with spaces of the same length, so an offset into the cleaned
 * text is an offset into the original and line numbers stay exact.
 */

export type JavaTypeKind = 'class' | 'interface' | 'enum' | 'record';

export interface FoundMethod {
  name: string;
  line: number;
}

export interface FoundType {
  name: string;
  kind: JavaTypeKind;
  line: number;
  /** Whether the declaration sits at the top level of the file. */
  topLevel: boolean;
  /** Simple names of the annotations on the declaration, in order. */
  annotations: string[];
  /** Simple names of the interfaces the type implements (a class or record) or extends (an interface). */
  implements: string[];
  methods: FoundMethod[];
}

/**
 * The stereotype annotations of `scanners/java/annotations`, mapped onto the
 * contract's building block types. `@Identifier` is a value object in the
 * contract's vocabulary; `@Module` marks a package, not a type, and has no
 * counterpart here.
 */
export const STEREOTYPE_ANNOTATIONS: Readonly<
  Record<string, DesignedBuildingBlockType>
> = {
  AggregateRoot: 'aggregate',
  Entity: 'entity',
  ValueObject: 'value_object',
  Identifier: 'value_object',
  DomainService: 'domain_service',
  ApplicationService: 'application_service',
  Repository: 'repository',
  Factory: 'factory',
  Port: 'external_integration',
  Adapter: 'external_integration',
  Command: 'domain_command',
  Query: 'domain_query',
  Event: 'domain_event',
};

/** The block type the annotations on a declaration name, or null when none is a stereotype. */
export function stereotypeOf(
  annotations: string[],
): DesignedBuildingBlockType | null {
  for (const annotation of annotations) {
    const type = STEREOTYPE_ANNOTATIONS[annotation];
    if (type !== undefined) return type;
  }
  return null;
}

const PACKAGE = /^[ \t]*package[ \t]+([\w.]+)[ \t]*;/m;

/** The declared package, or null for the default package. */
export function packageOf(content: string): string | null {
  return PACKAGE.exec(blankOut(content))?.[1] ?? null;
}

/*
 * A type declaration: any run of annotations and modifiers, then the kind
 * keyword and the name. The keyword must not follow `@` (an `@interface`
 * declares an annotation type) or `.` (`Order.class`).
 */
const ANNOTATION = String.raw`@[\w.]+(?:\s*\((?:[^()]|\([^()]*\))*\))?`;
const MODIFIER = String.raw`(?:public|protected|private|abstract|final|static|sealed|non-sealed|strictfp)\b`;
const TYPE_DECLARATION = new RegExp(
  String.raw`((?:(?:${ANNOTATION}|${MODIFIER})\s+)*)(?<![@.\w])(class|interface|enum|record)\s+(\w+)`,
  'g',
);
const ANNOTATION_NAME = /@([\w.]+)/g;
const METHODS_NEVER_BEHAVIOURS = new Set(['equals', 'hashCode', 'toString']);
const NOT_A_METHOD = /\b(class|interface|enum|record|new|return|throw)\b/;
const MODIFIER_WORD =
  /\b(?:public|protected|private|abstract|final|static|default|synchronized|native|strictfp|sealed|non-sealed)\b/g;

/** Every type declared in the file, in source order, with its public methods. */
export function typesOf(content: string): FoundType[] {
  const text = blankOut(content);
  const found: FoundType[] = [];
  const depth = new DepthCounter(text);
  for (const match of text.matchAll(TYPE_DECLARATION)) {
    const [, prefix = '', kind = '', name = ''] = match;
    const at = match.index + prefix.length;
    const body = bodyOf(text, at + kind.length + name.length + 1);
    found.push({
      name,
      kind: kind as JavaTypeKind,
      line: lineAt(text, at),
      topLevel: depth.at(at) === 0,
      annotations: annotationNames(prefix),
      implements: body
        ? supertypesOf(text.slice(at, body.open), kind as JavaTypeKind)
        : [],
      methods: body
        ? methodsOf(text, body.open + 1, body.close, name, kind as JavaTypeKind)
        : [],
    });
    // Nested types are matched in their turn as the scan proceeds.
  }
  return found;
}

/* --------------------------------------------------------------- helpers */

function annotationNames(prefix: string): string[] {
  return [...prefix.matchAll(ANNOTATION_NAME)].map((match) => {
    const qualified = match[1] ?? '';
    return qualified.slice(qualified.lastIndexOf('.') + 1);
  });
}

/**
 * The names after `implements` (class, record, enum) or `extends`
 * (interface) in a declaration header, generics dropped.
 */
function supertypesOf(header: string, kind: JavaTypeKind): string[] {
  const keyword = kind === 'interface' ? 'extends' : 'implements';
  const flat = withoutAngles(header);
  const at = new RegExp(String.raw`\b${keyword}\b`).exec(flat);
  if (!at) return [];
  const clause = flat
    .slice(at.index + keyword.length)
    .replace(/\bpermits\b[\s\S]*$/, '');
  return clause
    .split(',')
    .map((s) => s.trim())
    .map((s) => s.slice(s.lastIndexOf('.') + 1))
    .filter((s) => /^\w+$/.test(s));
}

/** The text with every balanced `<…>` removed, so generics do not hide or fake a keyword. */
function withoutAngles(text: string): string {
  let out = '';
  let depth = 0;
  for (const ch of text) {
    if (ch === '<') depth++;
    else if (ch === '>' && depth > 0) depth--;
    else if (depth === 0) out += ch;
  }
  return out;
}

/**
 * The `{ … }` of a declaration whose header starts at `from`: the first
 * brace outside parentheses (a record header has them). Null when the
 * declaration has no body, which Java does not allow but a truncated file
 * might show.
 */
function bodyOf(
  text: string,
  from: number,
): { open: number; close: number } | null {
  let parens = 0;
  for (let i = from; i < text.length; i++) {
    const ch = text[i];
    if (ch === '(') parens++;
    else if (ch === ')') parens--;
    else if (ch === '{' && parens === 0) {
      const close = matchingBrace(text, i);
      return close === -1 ? null : { open: i, close };
    } else if (ch === ';' && parens === 0) return null;
  }
  return null;
}

function matchingBrace(text: string, open: number): number {
  let depth = 0;
  for (let i = open; i < text.length; i++) {
    if (text[i] === '{') depth++;
    else if (text[i] === '}' && --depth === 0) return i;
  }
  return -1;
}

/**
 * The public methods declared directly in a body: its depth-0 statements
 * that look like a method header. Nested blocks (method bodies, nested
 * types, initialisers) end a statement and are skipped whole. Enums have no
 * behaviours here: their constants dominate the body and their methods are
 * rarely domain ones.
 */
function methodsOf(
  text: string,
  from: number,
  to: number,
  typeName: string,
  kind: JavaTypeKind,
): FoundMethod[] {
  if (kind === 'enum') return [];
  const methods: FoundMethod[] = [];
  const seen = new Set<string>();
  for (const statement of statementsOf(text, from, to)) {
    const method = methodOf(statement.text, typeName, kind);
    if (method === null || seen.has(method.name)) continue;
    seen.add(method.name);
    methods.push({
      name: method.name,
      line: lineAt(text, statement.start + method.offset),
    });
  }
  return methods;
}

interface Statement {
  text: string;
  /** Offset of `text[0]` in the file. */
  start: number;
}

/** The depth-0 statements between `from` and `to`: text up to a `;` or an opening brace, whose block is skipped. */
function statementsOf(text: string, from: number, to: number): Statement[] {
  const out: Statement[] = [];
  let start = from;
  let i = from;
  const emit = (end: number) => {
    const raw = text.slice(start, end);
    const lead = raw.length - raw.trimStart().length;
    if (raw.trim() !== '') out.push({ text: raw.trim(), start: start + lead });
  };
  while (i < to) {
    const ch = text[i];
    if (ch === ';') {
      emit(i);
      start = i + 1;
      i++;
    } else if (ch === '{') {
      emit(i);
      const close = matchingBrace(text, i);
      i = close === -1 ? to : close + 1;
      start = i;
    } else {
      i++;
    }
  }
  emit(to);
  return out;
}

/**
 * Reads one statement as a method header. Public is required in a class
 * or record; in an interface every member is public unless said otherwise.
 * Constructors, the Object trio and anything with an initialiser (a field)
 * or a statement keyword are not methods.
 */
function methodOf(
  statement: string,
  typeName: string,
  kind: JavaTypeKind,
): { name: string; offset: number } | null {
  const withoutAnnotations = blankAnnotations(statement);
  if (NOT_A_METHOD.test(withoutAnnotations)) return null;
  const parenAt = withoutAnnotations.indexOf('(');
  if (parenAt === -1) return null;
  const header = withoutAnnotations.slice(0, parenAt);
  if (header.includes('=')) return null;
  const modifiers: string[] = header.match(MODIFIER_WORD) ?? [];
  if (kind === 'interface') {
    if (modifiers.includes('private')) return null;
  } else if (!modifiers.includes('public')) return null;
  const trimmed = header.trimEnd();
  const name = trailingWord(trimmed);
  if (name === '') return null;
  if (name === typeName || METHODS_NEVER_BEHAVIOURS.has(name)) return null;
  // A header with only a name and no return type is a constructor of a
  // differently-named type or a call — neither is a method here.
  if (header.replace(MODIFIER_WORD, '').trim() === name) return null;
  return { name, offset: trimmed.length - name.length };
}

/** The run of word characters `text` ends with; empty when it ends otherwise. */
function trailingWord(text: string): string {
  let start = text.length;
  while (start > 0 && /\w/.test(text[start - 1] ?? '')) start--;
  return text.slice(start);
}

/** Comments and string/char literals replaced by spaces, newlines kept, so braces inside them do not count. */
export function blankOut(content: string): string {
  let out = '';
  let i = 0;
  const blank = (end: number) => {
    for (let j = i; j < end; j++) out += content[j] === '\n' ? '\n' : ' ';
    i = end;
  };
  while (i < content.length) {
    const two = content.slice(i, i + 2);
    if (two === '//') {
      const end = content.indexOf('\n', i);
      blank(end === -1 ? content.length : end);
    } else if (two === '/*') {
      const end = content.indexOf('*/', i + 2);
      blank(end === -1 ? content.length : end + 2);
    } else if (content.startsWith('"""', i)) {
      const end = content.indexOf('"""', i + 3);
      blank(end === -1 ? content.length : end + 3);
    } else if (content[i] === '"' || content[i] === "'") {
      blank(literalEnd(content, i));
    } else {
      out += content[i];
      i++;
    }
  }
  return out;
}

function literalEnd(content: string, open: number): number {
  const quote = content[open];
  for (let i = open + 1; i < content.length; i++) {
    if (content[i] === '\\') i++;
    else if (content[i] === quote || content[i] === '\n') return i + 1;
  }
  return content.length;
}

/** Annotations replaced by spaces of the same length, so offsets hold. */
function blankAnnotations(statement: string): string {
  return statement.replace(new RegExp(ANNOTATION, 'g'), (m) =>
    ' '.repeat(m.length),
  );
}

function lineAt(text: string, offset: number): number {
  let line = 1;
  for (let i = 0; i < offset; i++) if (text[i] === '\n') line++;
  return line;
}

/** Brace depth at increasing offsets, in one forward pass. */
class DepthCounter {
  private readonly text: string;
  private pos = 0;
  private depth = 0;

  constructor(text: string) {
    this.text = text;
  }

  at(offset: number): number {
    for (; this.pos < offset; this.pos++) {
      if (this.text[this.pos] === '{') this.depth++;
      else if (this.text[this.pos] === '}') this.depth--;
    }
    return this.depth;
  }
}
