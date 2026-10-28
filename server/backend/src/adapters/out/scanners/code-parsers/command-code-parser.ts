import { randomUUID } from 'node:crypto';
import { readdir, rm } from 'node:fs/promises';
import { basename, dirname, join } from 'node:path';
import { checkCodeModelSchema } from '#backend/app/scanners/code-parsers/check-code-model-schema';
import {
  CODE_MODEL_SCHEMA_VERSION,
  type CodeModelFile,
  CodeModelFile as CodeModelFileSchema,
  type Diagnostic,
  type Language,
  ParseManifest,
  ParseManifestHeader,
} from '#backend/app/scanners/code-parsers/code-model';
import type {
  CodeParser,
  ParsedCode,
} from '#backend/app/scanners/code-parsers/code-parser';
import { readJsonFile } from '#backend/platform/files/json-file';
import type { NoesisDir } from '#backend/platform/files/noesis-dir';
import { serverLogger } from '#backend/platform/logging/logging';

const OUTPUT_TAIL = 4000;
const CODE_MODEL_DIR = 'code-model';
const MANIFEST_FILE = 'manifest.json';

/**
 * A parser that runs a tool of one language, which writes the common code
 * model into a fresh `.noesis/tmp/<uuid>/`, removed once read. A model of
 * another language is refused. A subclass says only which command line to
 * run, and what to tell someone who cannot run it; every tool that writes
 * the model is read the same way.
 */
export abstract class CommandCodeParser implements CodeParser {
  private readonly log;

  protected constructor(
    protected readonly noesis: NoesisDir,
    private readonly language: Language,
  ) {
    this.log = serverLogger('scanner', language);
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
      throw new Error('The parser has no command to run.');
    }
    this.log.debug('Running {executable} {args}', { executable, args });
    const output = await this.run(executable, args, root);
    if (output.exitCode !== 0) {
      throw new Error(
        `${executable} failed with exit code ${output.exitCode}:\n${output.text.slice(-OUTPUT_TAIL)}`,
      );
    }
    const code = await readCodeModel(
      await manifestIn(codeModelDir, this.language, executable),
    );
    if (code.manifest.language !== this.language) {
      throw new Error(
        `${executable} wrote a ${code.manifest.language} code model; the ${this.language} parser reads only ${this.language}.`,
      );
    }
    return code;
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
    for (const { level, message } of parserDiagnostics(manifest, files)) {
      this.log[level]('{message}', { message });
    }
  }
}

/** What the service logs of the diagnostics the tool wrote. */
export interface ParserDiagnosticLine {
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
export function parserDiagnostics(
  manifest: ParseManifest,
  files: readonly CodeModelFile[],
): ParserDiagnosticLine[] {
  const lines: ParserDiagnosticLine[] = [];
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

/** `code-model/<language>/manifest.json`, refusing a tool that wrote a model of another language. */
async function manifestIn(
  codeModelDir: string,
  language: Language,
  executable: string,
): Promise<string> {
  let written: string[];
  try {
    written = (await readdir(codeModelDir, { withFileTypes: true }))
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name)
      .sort();
  } catch {
    written = [];
  }
  const others = written.filter((name) => name !== language);
  if (others.length > 0) {
    throw new Error(
      `${executable} wrote a code model of ${others.join(', ')} under ${codeModelDir}; the ${language} parser reads only ${language}.`,
    );
  }
  return join(codeModelDir, language, MANIFEST_FILE);
}

/**
 * Reads the manifest in two steps: first only the schema version and the
 * tool that wrote it, refusing a schema this service does not read, then the
 * whole manifest, so a mismatch is not buried under the fields that differ.
 */
async function readCodeModel(manifestPath: string): Promise<ParsedCode> {
  const unreadable = (message: string): never => {
    throw new Error(
      `The parser wrote no readable manifest at ${manifestPath}: ${message}`,
    );
  };
  const header = (await readJsonFile(manifestPath, ParseManifestHeader)).match(
    (value) => value,
    unreadable,
  );
  const refusal = checkCodeModelSchema(header, CODE_MODEL_SCHEMA_VERSION);
  if (refusal !== null) throw new Error(refusal);
  const manifest = (await readJsonFile(manifestPath, ParseManifest)).match(
    (value) => value,
    unreadable,
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
