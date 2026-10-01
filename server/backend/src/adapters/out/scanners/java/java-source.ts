import { BuildingBlockType } from '#backend/app/system-model/system-model';

/*
 * Extraction from one Java source file: regular expressions over a copy of
 * the text with comments, string literals and annotation arguments blanked
 * out, so braces and keywords inside them never count. Every blanking
 * replaces characters with spaces of the same length and keeps newlines, so
 * an offset into the cleaned text is an offset into the original: line
 * numbers stay exact and the Javadoc of a declaration is read back from the
 * original at the same place.
 *
 * The scanner is primitive on purpose: it reads declarations, not
 * expressions. Nothing Lombok generates is in the source, so nothing it
 * generates is read.
 */

type JavaTypeKind = 'class' | 'interface' | 'enum' | 'record';

interface JavaField {
  name: string;
  /** The type as written, generics included: `Option<Weather>`, `int[]`. */
  type: string;
  line: number;
  javadoc: string | null;
}

export interface JavaMethod {
  name: string;
  line: number;
  isPublic: boolean;
  /** As written; `void` for none. */
  returnType: string;
  /** The parameter types as written, in order. */
  parameterTypes: string[];
  javadoc: string | null;
}

export interface JavaType {
  name: string;
  kind: JavaTypeKind;
  line: number;
  /** Whether the declaration sits at the top level of the file. */
  topLevel: boolean;
  isPublic: boolean;
  /** The building block type its stereotype annotation names; null without one. */
  stereotype: BuildingBlockType | null;
  /** Simple names of what it extends and implements, generics dropped. */
  supertypes: string[];
  /** Instance fields, and a record's components. */
  fields: JavaField[];
  /** Methods other than private ones, constructors and the Object trio. */
  methods: JavaMethod[];
  javadoc: string | null;
}

export interface JavaSource {
  /** The declared package; null in the default package. */
  package: string | null;
  types: JavaType[];
}

/** The package of the Noesis Java annotations module. */
const NOESIS_ANNOTATIONS_PACKAGE = 'vision.noesis.annotations';

/**
 * The stereotype annotations of `scanners/java/annotations`, mapped onto
 * the model's building block types. `@Identifier` is a value object in the
 * model's vocabulary; a port and an adapter are both the integration they
 * stand for; `@Module` marks a package, not a type, and has no counterpart.
 */
const STEREOTYPE_ANNOTATIONS: Readonly<Record<string, BuildingBlockType>> = {
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

const PACKAGE = /^[ \t]*package[ \t]+([\w.]+)[ \t]*;/m;
const IMPORT = /^[ \t]*import[ \t]+([\w.]+)[ \t]*;/gm;

// An annotation's arguments are blanked out before matching, so only its
// name is left.
const ANNOTATION = String.raw`@[\w.]+`;
const MODIFIER = String.raw`(?:public|protected|private|abstract|final|static|sealed|non-sealed|strictfp)\b`;
// Annotations and modifiers, then the kind keyword and the name. The keyword
// must not follow `@` (an `@interface` declares an annotation type) or `.`
// (`Order.class`).
const TYPE_DECLARATION = new RegExp(
  String.raw`((?:(?:${ANNOTATION}|${MODIFIER})\s+)*)(?<![@.\w])(class|interface|enum|record)\s+(\w+)`,
  'g',
);
const ANNOTATION_NAME = /@([\w.]+)/g;
const ANNOTATION_HEAD = /@[\w.]+\s*/y;
const NOT_A_MEMBER = /\b(class|interface|enum|record|new|return|throw)\b/;
const MODIFIER_WORD =
  /\b(?:public|protected|private|abstract|final|static|default|synchronized|native|transient|volatile|strictfp|sealed|non-sealed)\b/g;
const OBJECT_METHODS = new Set(['equals', 'hashCode', 'toString']);

export function parseJavaSource(content: string): JavaSource {
  const text = blankAnnotationArguments(blankOut(content));
  return { package: packageOf(text), types: typesOf(content, text) };
}

/** The declared package, or null for the default package; `text` is blanked. */
function packageOf(text: string): string | null {
  return PACKAGE.exec(text)?.[1] ?? null;
}

/**
 * The block type the annotations declare, or null when none is a
 * stereotype. An annotation is a Noesis stereotype when written fully
 * qualified with the Noesis package, or by simple name unless an import
 * binds that name to another package (`import jakarta.persistence.Entity;`
 * makes `@Entity` JPA's).
 */
export function stereotypeOf(
  annotations: string[],
  foreignImports: ReadonlySet<string> = new Set(),
): BuildingBlockType | null {
  for (const annotation of annotations) {
    const simpleName = noesisSimpleName(annotation, foreignImports);
    const type =
      simpleName === null ? undefined : STEREOTYPE_ANNOTATIONS[simpleName];
    if (type !== undefined) return type;
  }
  return null;
}

/** The simple names the file imports from packages other than the Noesis one. */
function foreignlyImportedNames(text: string): Set<string> {
  const names = new Set<string>();
  for (const match of text.matchAll(IMPORT)) {
    const qualified = match[1] ?? '';
    const dot = qualified.lastIndexOf('.');
    if (dot === -1 || qualified.slice(0, dot) === NOESIS_ANNOTATIONS_PACKAGE)
      continue;
    names.add(qualified.slice(dot + 1));
  }
  return names;
}

/** Every type declared in the file, in source order; `text` is `content` blanked. */
function typesOf(content: string, text: string): JavaType[] {
  const foreignImports = foreignlyImportedNames(text);
  const depth = new DepthCounter(text);
  const found: JavaType[] = [];
  for (const match of text.matchAll(TYPE_DECLARATION)) {
    const [, prefix = '', kindWord = '', name = ''] = match;
    const kind = kindWord as JavaTypeKind;
    const at = match.index + prefix.length;
    const headerFrom = at + kindWord.length + name.length + 1;
    const body = bodyOf(text, headerFrom);
    const header = text.slice(headerFrom, body?.open ?? text.length);
    found.push({
      name,
      kind,
      line: lineAt(text, at),
      topLevel: depth.at(at) === 0,
      isPublic: /\bpublic\b/.test(prefix),
      stereotype: stereotypeOf(annotationNames(prefix), foreignImports),
      supertypes: supertypesOf(header, kind),
      fields: body ? fieldsOf(content, text, header, body, name, kind) : [],
      methods: body ? methodsOf(content, text, body, name, kind) : [],
      javadoc: javadocBefore(content, match.index),
    });
    // Nested types are matched in their turn as the scan proceeds.
  }
  return found;
}

/* ------------------------------------------------------------ blanking */

/** Comments and string/char literals replaced by spaces, newlines kept. */
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

/**
 * The parenthesised arguments of every annotation replaced by spaces, so an
 * annotation is its name alone however deeply its arguments nest. Runs on
 * blanked-out text, where no parenthesis hides in a string or a comment.
 */
export function blankAnnotationArguments(text: string): string {
  let out = '';
  let i = 0;
  while (i < text.length) {
    ANNOTATION_HEAD.lastIndex = i;
    const head = text[i] === '@' ? ANNOTATION_HEAD.exec(text) : null;
    if (head === null || text[i + head[0].length] !== '(') {
      out += text[i];
      i++;
      continue;
    }
    const argumentsStart = i + head[0].length;
    const argumentsEnd = matchingParenthesis(text, argumentsStart);
    out += head[0];
    for (let j = argumentsStart; j < argumentsEnd; j++)
      out += text[j] === '\n' ? '\n' : ' ';
    i = argumentsEnd;
  }
  return out;
}

/** Annotations replaced by spaces of the same length, so offsets hold. */
function blankAnnotations(statement: string): string {
  return statement.replace(new RegExp(ANNOTATION, 'g'), (m) =>
    ' '.repeat(m.length),
  );
}

/* ------------------------------------------------------- declarations */

/** The annotation names as written, simple or fully qualified. */
function annotationNames(prefix: string): string[] {
  return [...prefix.matchAll(ANNOTATION_NAME)].map((match) => match[1] ?? '');
}

function noesisSimpleName(
  annotation: string,
  foreignImports: ReadonlySet<string>,
): string | null {
  const dot = annotation.lastIndexOf('.');
  if (dot === -1) return foreignImports.has(annotation) ? null : annotation;
  return annotation.slice(0, dot) === NOESIS_ANNOTATIONS_PACKAGE
    ? annotation.slice(dot + 1)
    : null;
}

/**
 * The names after `extends` and `implements` in a declaration header,
 * generics dropped: a class names its superclass and its interfaces, an
 * interface the interfaces it extends.
 */
function supertypesOf(header: string, kind: JavaTypeKind): string[] {
  const flat = withoutAngles(withoutParentheses(header)).replace(
    /\bpermits\b[\s\S]*$/,
    '',
  );
  const keywords =
    kind === 'interface' ? ['extends'] : ['extends', 'implements'];
  const names: string[] = [];
  for (const keyword of keywords) {
    const at = new RegExp(String.raw`\b${keyword}\b`).exec(flat);
    if (!at) continue;
    const clause = flat
      .slice(at.index + keyword.length)
      .replace(/\b(?:extends|implements)\b[\s\S]*$/, '');
    for (const part of clause.split(',')) {
      const simple = simpleName(part.trim());
      if (/^\w+$/.test(simple)) names.push(simple);
    }
  }
  return names;
}

/** The text with every balanced `<…>` removed. */
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

/** The text with every balanced `(…)` removed: a record's header components. */
function withoutParentheses(text: string): string {
  let out = '';
  let depth = 0;
  for (const ch of text) {
    if (ch === '(') depth++;
    else if (ch === ')' && depth > 0) depth--;
    else if (depth === 0) out += ch;
  }
  return out;
}

interface Body {
  open: number;
  close: number;
}

/**
 * The `{ … }` of a declaration whose header starts at `from`: the first
 * brace outside parentheses (a record header has them). Null when the
 * declaration has no body, which Java does not allow but a truncated file
 * might show.
 */
function bodyOf(text: string, from: number): Body | null {
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

/** The index just past the `)` closing the parenthesis opened at `open`. */
function matchingParenthesis(text: string, open: number): number {
  let depth = 0;
  for (let i = open; i < text.length; i++) {
    if (text[i] === '(') depth++;
    else if (text[i] === ')' && --depth === 0) return i + 1;
  }
  return text.length;
}

/* ------------------------------------------------------------ members */

interface Statement {
  text: string;
  /** Offset of `text[0]` in the file. */
  start: number;
  /** Line of `text[0]`, 1-based. */
  line: number;
}

/**
 * The depth-0 statements of a body: text up to a `;` or an opening brace,
 * whose block (a method body, a nested type, an initialiser) is skipped
 * whole.
 */
function statementsOf(text: string, body: Body): Statement[] {
  const out: Statement[] = [];
  const to = body.close;
  let start = body.open + 1;
  let line = lineAt(text, start);
  let i = start;
  const emit = (end: number) => {
    const raw = text.slice(start, end);
    const lead = raw.length - raw.trimStart().length;
    if (raw.trim() !== '') {
      out.push({
        text: raw.trim(),
        start: start + lead,
        line: line + newlinesIn(raw.slice(0, lead)),
      });
    }
    line += newlinesIn(raw);
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
      const after = close === -1 ? to : close + 1;
      line += newlinesIn(text.slice(i, after));
      i = after;
      start = i;
    } else {
      i++;
    }
  }
  emit(to);
  return out;
}

function newlinesIn(text: string): number {
  let count = 0;
  for (const ch of text) if (ch === '\n') count++;
  return count;
}

/**
 * The methods declared directly in a body, other than private ones,
 * constructors and the Object trio. Enums have none here: their constants
 * dominate the body and their methods are rarely domain ones.
 */
function methodsOf(
  content: string,
  text: string,
  body: Body,
  typeName: string,
  kind: JavaTypeKind,
): JavaMethod[] {
  if (kind === 'enum') return [];
  const methods: JavaMethod[] = [];
  for (const statement of statementsOf(text, body)) {
    const method = methodOf(statement, typeName, kind);
    if (method === null) continue;
    methods.push({
      ...method,
      javadoc: javadocBefore(content, statement.start),
    });
  }
  return methods;
}

/**
 * Reads one statement as a method header. In a class or record a method is
 * public when it says so; in an interface every member is public unless it
 * says otherwise. Anything with an initialiser (a field) or a statement
 * keyword in its header is not a method.
 */
function methodOf(
  statement: Statement,
  typeName: string,
  kind: JavaTypeKind,
): JavaMethod | null {
  const flat = blankAnnotations(statement.text);
  const parenAt = flat.indexOf('(');
  if (parenAt === -1) return null;
  const header = flat.slice(0, parenAt);
  if (header.includes('=') || NOT_A_MEMBER.test(header)) return null;
  const modifiers: string[] = header.match(MODIFIER_WORD) ?? [];
  if (modifiers.includes('private')) return null;
  const trimmed = header.trimEnd();
  const name = trailingWord(trimmed);
  if (name === '' || name === typeName || OBJECT_METHODS.has(name)) return null;
  const signature = withoutTypeParameters(
    header.replace(MODIFIER_WORD, '').trim(),
  );
  const returnType = signature.slice(0, signature.length - name.length).trim();
  // Only a name and no return type: a call, or a constructor of another name.
  if (returnType === '') return null;
  return {
    name,
    line: statement.line + newlinesIn(trimmed.slice(0, -name.length)),
    isPublic: kind === 'interface' || modifiers.includes('public'),
    returnType,
    parameterTypes: parameterTypesOf(
      flat.slice(parenAt + 1, matchingParenthesis(flat, parenAt) - 1),
    ),
    javadoc: null,
  };
}

/** A method's leading `<T, …>` type parameters removed. */
function withoutTypeParameters(signature: string): string {
  if (!signature.startsWith('<')) return signature;
  let depth = 0;
  for (let i = 0; i < signature.length; i++) {
    if (signature[i] === '<') depth++;
    else if (signature[i] === '>' && --depth === 0)
      return signature.slice(i + 1).trim();
  }
  return signature;
}

/** The types of a parameter list, as written; `final` and names dropped. */
export function parameterTypesOf(list: string): string[] {
  return splitTopLevel(blankAnnotations(list), ',')
    .map((parameter) => parameter.replace(/\bfinal\b/g, '').trim())
    .filter((parameter) => parameter !== '')
    .map((parameter) => {
      const name = trailingWord(parameter);
      return parameter.slice(0, parameter.length - name.length).trim();
    })
    .filter((type) => type !== '');
}

/** `text` split at `separator` outside `<…>` and `(…)`. */
function splitTopLevel(text: string, separator: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let current = '';
  for (const ch of text) {
    if (ch === '<' || ch === '(') depth++;
    else if (ch === '>' || ch === ')') depth--;
    if (ch === separator && depth === 0) {
      parts.push(current);
      current = '';
    } else {
      current += ch;
    }
  }
  parts.push(current);
  return parts;
}

/**
 * The instance fields declared directly in a body, and a record's header
 * components. Static fields are constants, not state; an interface's fields
 * are static by definition.
 */
function fieldsOf(
  content: string,
  text: string,
  header: string,
  body: Body,
  typeName: string,
  kind: JavaTypeKind,
): JavaField[] {
  if (kind === 'enum' || kind === 'interface') return [];
  const fields: JavaField[] = [];
  if (kind === 'record') {
    const open = header.indexOf('(');
    const parameters =
      open === -1
        ? ''
        : header.slice(open + 1, matchingParenthesis(header, open) - 1);
    const line = lineAt(text, body.open);
    for (const component of componentsOf(parameters)) {
      fields.push({ ...component, line, javadoc: null });
    }
  }
  for (const statement of statementsOf(text, body)) {
    const field = fieldOf(statement, typeName);
    if (field === null) continue;
    fields.push({ ...field, javadoc: javadocBefore(content, statement.start) });
  }
  return fields;
}

function componentsOf(parameters: string): { name: string; type: string }[] {
  return splitTopLevel(blankAnnotations(parameters), ',')
    .map((parameter) => parameter.trim())
    .filter((parameter) => parameter !== '')
    .map((parameter) => {
      const name = trailingWord(parameter);
      return {
        name,
        type: parameter.slice(0, parameter.length - name.length).trim(),
      };
    })
    .filter(({ name, type }) => name !== '' && type !== '');
}

/**
 * Reads one statement as a field declaration: modifiers, a type and a
 * name, with or without an initialiser, and no parenthesis before it.
 */
function fieldOf(statement: Statement, typeName: string): JavaField | null {
  const flat = blankAnnotations(statement.text);
  const assignAt = flat.indexOf('=');
  const declaration = (assignAt === -1 ? flat : flat.slice(0, assignAt)).trim();
  if (declaration.includes('(') || NOT_A_MEMBER.test(declaration)) return null;
  const modifiers: string[] = declaration.match(MODIFIER_WORD) ?? [];
  if (modifiers.includes('static')) return null;
  const typed = declaration.replace(MODIFIER_WORD, '').trim();
  const name = trailingWord(typed);
  const type = typed.slice(0, typed.length - name.length).trim();
  if (name === '' || type === '' || name === typeName) return null;
  return { name, type, line: statement.line, javadoc: null };
}

/* ------------------------------------------------------------ text */

/** The run of word characters `text` ends with; empty when it ends otherwise. */
function trailingWord(text: string): string {
  let start = text.length;
  while (start > 0 && /\w/.test(text[start - 1] ?? '')) start--;
  return text.slice(start);
}

function simpleName(qualified: string): string {
  return qualified.slice(qualified.lastIndexOf('.') + 1);
}

function lineAt(text: string, offset: number): number {
  let line = 1;
  for (let i = 0; i < offset && i < text.length; i++)
    if (text[i] === '\n') line++;
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

/* ------------------------------------------------------------ javadoc */

/**
 * The first sentence of the Javadoc comment that ends right before
 * `offset` in the original text, whitespace apart; null when there is none.
 */
export function javadocBefore(content: string, offset: number): string | null {
  let end = offset;
  while (end > 0 && /\s/.test(content[end - 1] ?? '')) end--;
  if (!content.startsWith('*/', end - 2)) return null;
  const start = content.lastIndexOf('/**', end - 2);
  if (start === -1 || content.indexOf('*/', start + 3) !== end - 2) return null;
  const lines = content
    .slice(start + 3, end - 2)
    .split('\n')
    .map((line) => line.replace(/^\s*\*+\s?/, '').trim());
  const description = lines
    .slice(
      0,
      lines.findIndex((line) => line.startsWith('@')) === -1
        ? lines.length
        : lines.findIndex((line) => line.startsWith('@')),
    )
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();
  const sentenceEnd = /\.(\s|$)/.exec(description);
  const sentence =
    sentenceEnd === null
      ? description
      : description.slice(0, sentenceEnd.index + 1);
  return sentence === '' ? null : sentence;
}
