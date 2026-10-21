import type { Annotation, AnnotationValue } from '../code-model';
import type { AnnotationRole, AnnotationVocabulary } from './vocabulary';

/*
 * Reading annotations the way the projection needs them: by role, and by the
 * name of an argument. A literal comes as the compiler spelled it (`"Forex"`,
 * `null`), so it is unquoted here, and `null` — an optional parameter the
 * code left out — counts as absent.
 */

export interface RoleOf<R extends AnnotationRole['role']> {
  readonly annotation: Annotation;
  readonly role: Extract<AnnotationRole, { role: R }>;
}

/** The annotations of `annotations` the vocabulary gives `role`, in declaration order. */
export function rolesOf<R extends AnnotationRole['role']>(
  annotations: readonly Annotation[],
  role: R,
  vocabulary: AnnotationVocabulary,
): RoleOf<R>[] {
  const found: RoleOf<R>[] = [];
  for (const annotation of annotations) {
    if (annotation.type.kind !== 'named') continue;
    const known = vocabulary.roles.get(annotation.type.type);
    if (known?.role === role) {
      found.push({
        annotation,
        role: known as Extract<AnnotationRole, { role: R }>,
      });
    }
  }
  return found;
}

export function hasRole(
  annotations: readonly Annotation[],
  role: AnnotationRole['role'],
  vocabulary: AnnotationVocabulary,
): boolean {
  return rolesOf(annotations, role, vocabulary).length > 0;
}

/** The text of the string argument `name`, unquoted; null when absent or `null`. */
export function stringArgument(
  annotation: Annotation,
  name: string,
): string | null {
  const value = argumentValue(annotation, name);
  return value?.kind === 'literal' ? unquote(value.text) : null;
}

/** The member of the enum argument `name` (`TriggeredBy.Command` → `Command`); null when absent. */
export function enumArgument(
  annotation: Annotation,
  name: string,
): string | null {
  const value = argumentValue(annotation, name);
  return value?.kind === 'enum' ? value.member : null;
}

function argumentValue(
  annotation: Annotation,
  name: string,
): AnnotationValue | undefined {
  return annotation.arguments.find((argument) => argument.name === name)?.value;
}

const ESCAPES: Record<string, string> = {
  n: '\n',
  r: '\r',
  t: '\t',
  '0': '\0',
  '\\': '\\',
  '"': '"',
  "'": "'",
};

/**
 * The string a C# literal spells: a regular `"…"` with its escapes, a
 * verbatim `@"…"` with `""` for a quote, or a raw `"""…"""`. `null` is no
 * string. Anything else is taken as it is.
 */
export function unquote(literal: string): string | null {
  const text = literal.trim();
  if (text === 'null') return null;
  if (text.startsWith('"""')) {
    const end = text.lastIndexOf('"""');
    return end > 2 ? text.slice(3, end).trim() : text;
  }
  if (text.startsWith('@"') && text.endsWith('"')) {
    return text.slice(2, -1).replaceAll('""', '"');
  }
  if (text.startsWith('"') && text.endsWith('"') && text.length >= 2) {
    return unescape(text.slice(1, -1));
  }
  return text;
}

function unescape(body: string): string {
  return body.replace(
    /\\(u[0-9a-fA-F]{4}|x[0-9a-fA-F]{1,4}|.)/g,
    (whole, code: string) => {
      if (code.startsWith('u') || code.startsWith('x')) {
        return String.fromCharCode(Number.parseInt(code.slice(1), 16));
      }
      return ESCAPES[code] ?? whole;
    },
  );
}
