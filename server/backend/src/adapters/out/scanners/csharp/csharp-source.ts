import type { BuildingBlockType } from '#backend/app/system-model/system-model';

/** The `NoesisVision.Annotations` attribute each building block type is marked with. */
const BUILDING_BLOCK_ATTRIBUTES: Record<string, BuildingBlockType> = {
  DddAggregate: 'aggregate',
  DddEntity: 'entity',
  DddValueObject: 'value_object',
  DddDomainService: 'domain_service',
  DddApplicationService: 'application_service',
  DddRepository: 'repository',
  DddFactory: 'factory',
};

const ANNOTATED_TYPE_PATTERN = new RegExp(
  String.raw`\[(${Object.keys(BUILDING_BLOCK_ATTRIBUTES).join('|')})(?:Attribute)?(?:\s*\(\s*"([^"]*)"\s*\))?\s*\]` +
    String.raw`[\s\S]*?\b(class|struct|interface|enum|record|delegate)\s+(\w+)`,
  'g',
);

const NAMESPACE_PATTERN = /^\s*namespace\s+([\w.]+)\s*[;{]/m;

const DISQUALIFYING_METHOD_KEYWORDS =
  /\b(class|struct|interface|enum|record|delegate|event|operator|namespace|using)\b/;

const DOMAIN_BEHAVIOR_ATTRIBUTE_PATTERN =
  /\[DomainBehavior(?:Attribute)?(?:\s*\(\s*"([^"]*)"\s*\))?\s*]/;

const ACTOR_ATTRIBUTE_PATTERN =
  /\[Actor(?:Attribute)?\s*\(\s*"([^"]*)"\s*\)\s*]/;

/** A return type that gives nothing back, so the method only changes state. */
const NO_RESULT_PATTERN = /\b(?:void|Task|ValueTask)$/;

const TECHNICAL_METHOD_NAMES = new Set([
  'Equals',
  'GetHashCode',
  'GetType',
  'ToString',
  'Finalize',
  'MemberwiseClone',
  'Deconstruct',
  'PrintMembers',
]);

export interface CSharpNamespace {
  name: string;
  line: number;
}

export interface CSharpMethod {
  name: string;
  /** From `[DomainBehavior("…")]`. */
  nameOverride: string | null;
  /** From `[Actor("…")]`. */
  actor: string | null;
  returnsResult: boolean;
  line: number;
}

export interface CSharpAnnotatedType {
  buildingBlockType: BuildingBlockType;
  name: string;
  /** From the building block attribute's argument. */
  nameOverride: string | null;
  line: number;
  methods: CSharpMethod[];
}

export interface CSharpSourceFile {
  /** The first namespace the file declares. */
  namespace: CSharpNamespace | null;
  types: CSharpAnnotatedType[];
}

/**
 * Reads a `.cs` file's text, without compiling it: the types marked with a
 * building block attribute, and the public methods of each.
 */
export function parseCSharpSource(content: string): CSharpSourceFile {
  return {
    namespace: parseNamespace(content),
    types: parseAnnotatedTypes(content),
  };
}

function parseNamespace(content: string): CSharpNamespace | null {
  const match = NAMESPACE_PATTERN.exec(content);
  if (!match) return null;
  const name = match[1]!;
  return { name, line: lineAt(content, match.index + match[0].indexOf(name)) };
}

function parseAnnotatedTypes(content: string): CSharpAnnotatedType[] {
  const types: CSharpAnnotatedType[] = [];
  for (const match of content.matchAll(ANNOTATED_TYPE_PATTERN)) {
    const [whole, attribute, nameOverride, typeKind, name] = match;
    const end = match.index + whole.length;
    types.push({
      buildingBlockType: BUILDING_BLOCK_ATTRIBUTES[attribute!]!,
      name: name!,
      nameOverride: nameOverride ?? null,
      line: lineAt(content, end - name!.length),
      methods: parseMethods(content, end, name!, typeKind!),
    });
  }
  return types;
}

function parseMethods(
  content: string,
  searchStart: number,
  typeName: string,
  typeKind: string,
): CSharpMethod[] {
  if (typeKind === 'enum' || typeKind === 'delegate') return [];
  const bodyStart = findTypeBodyStart(content, searchStart);
  if (bodyStart === -1) return [];
  const bodyEnd = findMatchingBrace(content, bodyStart);
  if (bodyEnd === -1) return [];

  // Both blankings keep every offset, so a method's offset in the flattened
  // body is its offset in the file.
  const bodyOffset = bodyStart + 1;
  const body = flattenBraceBlocks(
    blankComments(content.slice(bodyOffset, bodyEnd)),
  );

  const seen = new Set<string>();
  const methods: CSharpMethod[] = [];
  let statementOffset = bodyOffset;
  for (const statement of body.split(';')) {
    const method = parseMethodStatement(statement, typeName, typeKind);
    if (method) {
      const key = `${method.name}|${method.nameOverride ?? ''}`;
      if (!seen.has(key)) {
        seen.add(key);
        methods.push({
          ...method,
          line: lineAt(content, statementOffset + method.offset),
        });
      }
    }
    statementOffset += statement.length + 1;
  }
  return methods;
}

function findTypeBodyStart(content: string, from: number): number {
  for (let i = from; i < content.length; i++) {
    const ch = content[i];
    if (ch === '{') return i;
    if (ch === ';') return -1;
  }
  return -1;
}

function findMatchingBrace(content: string, start: number): number {
  let depth = 0;
  for (let i = start; i < content.length; i++) {
    if (content[i] === '{') depth++;
    else if (content[i] === '}') {
      depth--;
      if (depth === 0) return i;
    }
  }
  return -1;
}

function blankComments(content: string): string {
  return content
    .replaceAll(/\/\*[\s\S]*?\*\//g, blank)
    .replaceAll(/\/\/[^\n]*/g, blank);
}

/**
 * Blanks every nested block, and ends the statement each opens, so the body
 * splits on `;` into its members' declarations.
 */
function flattenBraceBlocks(content: string): string {
  let result = '';
  let depth = 0;
  // By code unit, not code point, so blanking keeps the length.
  for (let i = 0; i < content.length; i++) {
    const ch = content[i]!;
    if (ch === '{') {
      result += depth === 0 ? ';' : ' ';
      depth++;
    } else if (ch === '}') {
      if (depth > 0) depth--;
      result += ' ';
    } else {
      result += depth === 0 || ch === '\n' ? ch : ' ';
    }
  }
  return result;
}

function blank(text: string): string {
  return text.replaceAll(/[^\n]/g, ' ');
}

function parseMethodStatement(
  statement: string,
  typeName: string,
  typeKind: string,
): (Omit<CSharpMethod, 'line'> & { offset: number }) | null {
  const nameOverride =
    DOMAIN_BEHAVIOR_ATTRIBUTE_PATTERN.exec(statement)?.[1] ?? null;
  const actor = ACTOR_ATTRIBUTE_PATTERN.exec(statement)?.[1] ?? null;

  const withoutAttributes = statement.replaceAll(/\[[^\]]*]/g, blank);
  if (DISQUALIFYING_METHOD_KEYWORDS.test(withoutAttributes)) return null;

  const isInterface = typeKind === 'interface';
  if (!isInterface && !/\bpublic\b/.test(withoutAttributes)) return null;
  if (isInterface && /\b(private|internal|protected)\b/.test(withoutAttributes))
    return null;

  const parenIndex = withoutAttributes.indexOf('(');
  if (parenIndex === -1) return null;
  const beforeParen = withoutAttributes.slice(0, parenIndex);
  if (beforeParen.includes('=')) return null;

  const nameMatch = /(\w+)\s*$/.exec(beforeParen);
  if (!nameMatch) return null;
  const name = nameMatch[1]!;
  if (name === typeName || name === 'this' || name === 'base') return null;
  if (TECHNICAL_METHOD_NAMES.has(name)) return null;

  const returnType = beforeParen.slice(0, nameMatch.index).trim();
  return {
    name,
    nameOverride,
    actor,
    returnsResult: !NO_RESULT_PATTERN.test(returnType),
    offset: nameMatch.index,
  };
}

function lineAt(content: string, offset: number): number {
  let line = 1;
  for (let i = 0; i < offset; i++) if (content[i] === '\n') line++;
  return line;
}
