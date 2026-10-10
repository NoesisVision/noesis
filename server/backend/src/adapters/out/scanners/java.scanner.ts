import { readFile } from 'node:fs/promises';
import { basename, relative, sep } from 'node:path';
import type { Now } from '#backend/app/clock';
import type { SourceCodeScanner } from '#backend/app/system-model/source-code-scanner';
import type { SystemModel } from '#backend/app/system-model/system-model';
import { SystemModelId } from '#backend/app/system-model/system-model-id';
import type { NoesisDir } from '#backend/platform/files/noesis-dir';
import { findJavaSources } from './java/java-files';
import { type ParsedJavaFile, projectJavaModel } from './java/java-model';
import { parseJavaSource } from './java/java-source';

export interface JavaScannerDeps {
  noesis: NoesisDir;
  now: Now;
}

/**
 * The primitive Java scanner: regular expressions over the checkout's main
 * sources, no compilation. It finds the building blocks by the stereotype
 * annotations of `scanners/java/annotations` and reads their fields and
 * methods; relations between blocks beyond `implements` are left to a
 * deeper scanner. The model is the whole repository, named after it.
 */
export class JavaSourceCodeScanner implements SourceCodeScanner {
  private readonly noesis: NoesisDir;
  private readonly now: Now;

  constructor({ noesis, now }: JavaScannerDeps) {
    this.noesis = noesis;
    this.now = now;
  }

  /** Mints the id as the scan starts, so the newest scan has the highest id. */
  async scan(): Promise<SystemModel> {
    const id = SystemModelId.mint();
    const scannedAt = this.now();
    const root = this.noesis.root;
    const paths = await findJavaSources(root);
    if (paths.length === 0) {
      throw new Error(
        `No Java sources under ${root}: nothing to scan. The Java scanner reads .java files outside src/test and build output.`,
      );
    }
    const files = await Promise.all(
      paths.map((path) => this.parse(root, path)),
    );
    return {
      id,
      name: basename(root),
      scanned_at: scannedAt,
      ...projectJavaModel(files),
    };
  }

  private async parse(root: string, path: string): Promise<ParsedJavaFile> {
    const content = await readFile(path, 'utf8');
    return {
      path: relative(root, path).split(sep).join('/'),
      source: parseJavaSource(content),
    };
  }
}
