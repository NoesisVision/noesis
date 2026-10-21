import { z } from 'zod';

/*
 * How namespaces map to module paths (section 6 of
 * docs/plans/code-model-to-system-model.md): `noesis-config.json` at the
 * repository root names the dotted sequences to drop wherever they occur
 * (a company prefix) and the patterns whose namespaces are not in the model
 * at all. The adapter reads the file; this is the rule.
 */

export const NamespaceConfigSchema = z.object({
  /** Dotted sequences dropped wherever they occur, e.g. a company prefix. */
  namespacePartsToSkip: z.array(z.string()).default([]),
  /** Patterns whose `*` stands for any number of parts, e.g. `*.Tests.*`. */
  namespacesToExclude: z.array(z.string()).default([]),
});
export type NamespaceConfigInput = z.input<typeof NamespaceConfigSchema>;

export class NamespaceConfig {
  private readonly partsToSkip: string[][];
  private readonly patternsToExclude: string[][];

  private constructor({
    namespacePartsToSkip,
    namespacesToExclude,
  }: z.infer<typeof NamespaceConfigSchema>) {
    this.partsToSkip = namespacePartsToSkip
      .filter((parts) => parts !== '')
      .map((parts) => parts.split('.'));
    this.patternsToExclude = namespacesToExclude
      .filter((pattern) => pattern !== '')
      .map((pattern) => pattern.split('.'));
  }

  static of(config: NamespaceConfigInput = {}): NamespaceConfig {
    return new NamespaceConfig(NamespaceConfigSchema.parse(config));
  }

  /** The module path `namespace` maps to, as segments; null when excluded or nothing is left. */
  modulePathOf(namespace: string): string[] | null {
    const parts = namespace.split('.');
    if (this.patternsToExclude.some((pattern) => matches(pattern, parts))) {
      return null;
    }
    const kept = this.partsToSkip.reduce(withoutSequence, parts);
    return kept.length === 0 ? null : kept;
  }
}

function matches(pattern: string[], parts: string[]): boolean {
  if (pattern.length === 0) return parts.length === 0;
  const [token, ...restOfPattern] = pattern;
  if (token === '*') {
    for (let skipped = 0; skipped <= parts.length; skipped++) {
      if (matches(restOfPattern, parts.slice(skipped))) return true;
    }
    return false;
  }
  return parts[0] === token && matches(restOfPattern, parts.slice(1));
}

function withoutSequence(parts: string[], sequence: string[]): string[] {
  const result: string[] = [];
  let i = 0;
  while (i < parts.length) {
    if (sequence.every((part, j) => parts[i + j] === part)) {
      i += sequence.length;
    } else {
      result.push(parts[i]!);
      i++;
    }
  }
  return result;
}
