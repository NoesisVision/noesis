import { join } from 'node:path';
import { z } from 'zod';

const CONFIG_FILE = 'noesis-config.json';

const NamespaceConfigSchema = z.object({
  /** Dotted sequences dropped wherever they occur, e.g. a company prefix. */
  namespacePartsToSkip: z.array(z.string()).default([]),
  /** Patterns whose `*` stands for any number of parts, e.g. `*.Tests.*`. */
  namespacesToExclude: z.array(z.string()).default([]),
});

/** How C# namespaces map to module paths, from `noesis-config.json` at the repository root. */
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

  static of(config: z.input<typeof NamespaceConfigSchema>): NamespaceConfig {
    return new NamespaceConfig(NamespaceConfigSchema.parse(config));
  }

  /** No file maps every namespace to itself. */
  static async load(repositoryRoot: string): Promise<NamespaceConfig> {
    const file = Bun.file(join(repositoryRoot, CONFIG_FILE));
    if (!(await file.exists())) return NamespaceConfig.of({});
    const parsed = NamespaceConfigSchema.safeParse(await file.json());
    if (!parsed.success) {
      throw new Error(
        `Invalid ${CONFIG_FILE}:\n${z.prettifyError(parsed.error)}`,
      );
    }
    return new NamespaceConfig(parsed.data);
  }

  /** The module path `namespace` maps to; null when excluded or nothing is left. */
  modulePathOf(namespace: string): string | null {
    const parts = namespace.split('.');
    if (this.patternsToExclude.some((pattern) => matches(pattern, parts))) {
      return null;
    }
    const kept = this.partsToSkip.reduce(withoutSequence, parts);
    return kept.length === 0 ? null : kept.join('.');
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
