import { randomUUID } from 'node:crypto';
import { readdir, rm } from 'node:fs/promises';
import { basename, dirname, join } from 'node:path';
import {
  type CodeModelFile,
  CodeModelFile as CodeModelFileSchema,
  type Diagnostic,
  ScanManifest,
} from '#backend/app/scanner/code-model/code-model';
import type {
  CodeParser,
  ParsedCode,
} from '#backend/app/scanner/code-model/code-parser';
import { readJsonFile } from '#backend/platform/files/json-file';
import type { NoesisDir } from '#backend/platform/files/noesis-dir';
import { serverLogger } from '#backend/platform/logging/logging';

const OUTPUT_TAIL = 4000;
const CODE_MODEL_DIR = 'code-model';
const MANIFEST_FILE = 'manifest.json';

/**
 * A parser that runs a tool of the repository's language, which writes the
 * common code model into a fresh `.noesis/tmp/<uuid>/`, removed once read.
 * A subclass says only which command line to run, and what to tell someone
 * who cannot run it; every tool that writes the model is read the same way.
 */
export abstract class CommandCodeParser implements CodeParser {
  private readonly log;

  protected constructor(
    protected readonly noesis: NoesisDir,
    name: string,
  ) {
    this.log = serverLogger('scanner', name);
  }

  /** The whole command line that scans `root` into `outDir` as `name`, run from `root`. */
  protected abstract commandLine(
    root: string,
    name: string,
    outDir: string,
  ): Promise<readonly string[]>;

  /** What to do when the tool cannot be started. */
  protected abstract installHint(): string;

  /** Runs the tool into a fresh tmp directory, reads what it wrote and removes it. */
  async parse(): Promise<ParsedCode> {
    const outDir = this.noesis.resolve('tmp', randomUUID());
    try {
      const code = await this.runTool(outDir);
      this.logToolDiagnostics(code);
      return code;
    } finally {
      await rm(outDir, { recursive: true, force: true });
    }
  }

  private async runTool(outDir: string): Promise<ParsedCode> {
    const root = this.noesis.root;
    const codeModelDir = join(outDir, CODE_MODEL_DIR);
    const [executable, ...args] = await this.commandLine(
      root,
      basename(root),
      outDir,
    );
    if (executable === undefined) {
      throw new Error('The code model scanner has no command to run.');
    }
    this.log.debug('Running {executable} {args}', { executable, args });
    const output = await this.run(executable, args, root);
    if (output.exitCode !== 0) {
      throw new Error(
        `${executable} failed with exit code ${output.exitCode}:\n${output.text.slice(-OUTPUT_TAIL)}`,
      );
    }
    return readCodeModel(await manifestIn(codeModelDir, executable));
  }

  private async run(
    executable: string,
    args: string[],
    cwd: string,
  ): Promise<{ exitCode: number; text: string }> {
    let process: Bun.Subprocess<'ignore', 'pipe', 'pipe'>;
    try {
      process = Bun.spawn([executable, ...args], {
        cwd,
        stdin: 'ignore',
        stdout: 'pipe',
        stderr: 'pipe',
      });
    } catch (error) {
      throw new Error(
        `Cannot run ${executable}: ${String(error)}. ${this.installHint()}`,
      );
    }
    const [stdout, stderr, exitCode] = await Promise.all([
      new Response(process.stdout).text(),
      new Response(process.stderr).text(),
      process.exited,
    ]);
    return { exitCode, text: `${stdout}${stderr}` };
  }

  private logToolDiagnostics({ manifest, files }: ParsedCode): void {
    // The message is a property, not the template: javac's messages may hold braces.
    for (const { level, message } of scannerDiagnostics(manifest, files)) {
      this.log[level]('{message}', { message });
    }
  }
}

/** What the service logs of the diagnostics the tool wrote. */
export interface ScannerDiagnosticLine {
  level: 'error' | 'warning';
  message: string;
}

/**
 * The tool's own errors and warnings, one line each: a module it could not
 * scan, a JDK it could not bind against. A module still gets a file then,
 * so without these lines it would only be missing from the system model.
 * The compiler's are many and repeat what the build says, so each artifact
 * gets one line counting them, with the first error. Info is left out.
 */
export function scannerDiagnostics(
  manifest: ScanManifest,
  files: readonly CodeModelFile[],
): ScannerDiagnosticLine[] {
  const lines: ScannerDiagnosticLine[] = [];
  for (const diagnostic of manifest.diagnostics) {
    const level = levelOf(diagnostic);
    if (level !== null) lines.push({ level, message: describe(diagnostic) });
  }
  for (const file of files) {
    const name = file.artifact.name;
    const compiler: Diagnostic[] = [];
    for (const diagnostic of file.diagnostics) {
      const level = levelOf(diagnostic);
      if (level === null) continue;
      if (diagnostic.source === 'compiler') compiler.push(diagnostic);
      else lines.push({ level, message: `${name}: ${describe(diagnostic)}` });
    }
    const errors = compiler.filter(({ severity }) => severity === 'error');
    if (compiler.length > 0) {
      const first = errors[0] ?? compiler[0]!;
      lines.push({
        level: errors.length > 0 ? 'error' : 'warning',
        message: `${name}: the compiler reported ${errors.length} errors and ${compiler.length - errors.length} warnings; first: ${describe(first)}`,
      });
    }
  }
  return lines;
}

function levelOf({ severity }: Diagnostic): 'error' | 'warning' | null {
  return severity === 'info' ? null : severity;
}

function describe({ code, message, location }: Diagnostic): string {
  const where =
    location === null ? '' : ` (${location.file}:${location.startLine})`;
  return `${code} ${message}${where}`;
}

/** Fills `{out}`, `{root}` and `{name}` in a configured command line. */
export function fillCommand(
  command: readonly string[],
  values: { out: string; root: string; name: string },
): string[] {
  return command.map((argument) =>
    argument
      .replaceAll('{out}', values.out)
      .replaceAll('{root}', values.root)
      .replaceAll('{name}', values.name),
  );
}

/** The one `code-model/<language>/manifest.json` the tool wrote; the language is the tool's to say. */
async function manifestIn(
  codeModelDir: string,
  executable: string,
): Promise<string> {
  let languages: string[];
  try {
    languages = (await readdir(codeModelDir, { withFileTypes: true }))
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name)
      .sort();
  } catch {
    languages = [];
  }
  const manifests: string[] = [];
  for (const language of languages) {
    const manifest = join(codeModelDir, language, MANIFEST_FILE);
    if (await Bun.file(manifest).exists()) manifests.push(manifest);
  }
  if (manifests.length > 1) {
    throw new Error(
      `${executable} wrote more than one code model under ${codeModelDir} (${languages.join(', ')}); one scan projects one.`,
    );
  }
  // One expected manifest path keeps the error readable when nothing was written.
  return manifests[0] ?? join(codeModelDir, '<language>', MANIFEST_FILE);
}

async function readCodeModel(manifestPath: string): Promise<ParsedCode> {
  const manifest = (await readJsonFile(manifestPath, ScanManifest)).match(
    (value) => value,
    (message) => {
      throw new Error(
        `The scanner wrote no readable manifest at ${manifestPath}: ${message}`,
      );
    },
  );
  const outDir = join(dirname(manifestPath), '..', '..');
  const files = await Promise.all(
    manifest.artifacts.map(async ({ file }) => {
      const path = join(outDir, file);
      return (await readJsonFile(path, CodeModelFileSchema)).match(
        (value) => value,
        (message) => {
          throw new Error(
            `The code model file ${path} does not fit the schema: ${message}`,
          );
        },
      );
    }),
  );
  return { manifest, files };
}
