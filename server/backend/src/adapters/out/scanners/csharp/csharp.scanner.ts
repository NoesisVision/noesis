import { randomUUID } from 'node:crypto';
import { rm } from 'node:fs/promises';
import { basename, dirname, join } from 'node:path';
import type { Now } from '#backend/app/clock';
import {
  type CodeModelFile,
  CodeModelFile as CodeModelFileSchema,
  ScanManifest,
} from '#backend/app/code-model/code-model';
import { CSHARP_VOCABULARY } from '#backend/app/code-model/projection/csharp.vocabulary';
import type { NamespaceConfig } from '#backend/app/code-model/projection/namespace-config';
import {
  type ProjectionDiagnostic,
  projectSystemModel,
} from '#backend/app/code-model/projection/project-system-model';
import type { SourceCodeScanner } from '#backend/app/system-model/source-code-scanner';
import type { SystemModel } from '#backend/app/system-model/system-model';
import { SystemModelId } from '#backend/app/system-model/system-model-id';
import { readJsonFile } from '#backend/platform/files/json-file';
import type { NoesisDir } from '#backend/platform/files/noesis-dir';
import { serverLogger } from '#backend/platform/logging/logging';
import { headCommit } from '../head-commit';

/** The `dotnet tool`, on the PATH of the machine the server runs on. */
const DEFAULT_COMMAND = ['noesis-scan-csharp'];
/** Where the tool writes under `--out`. */
const MANIFEST = join('code-model', 'csharp', 'manifest.json');
/** Under `.noesis/`: the tool's model cache, a ring per project; scanners/dotnet/README.md. */
const CACHE_DIR = ['cache', 'scanner', 'csharp'] as const;
const OUTPUT_TAIL = 4000;

const log = serverLogger('scanner', 'csharp');

export interface CSharpScannerDeps {
  noesis: NoesisDir;
  now: Now;
  /** How namespaces map to modules, from the repository's settings. */
  namespaces: NamespaceConfig;
  /** The first stage's command and leading arguments; `noesis-scan-csharp` unless given. */
  command?: readonly string[];
}

/**
 * The C# scanner in two stages: `noesis-scan-csharp` (scanners/dotnet) reads
 * the solution with Roslyn and writes the code model into a fresh
 * `.noesis/tmp/<uuid>/`, removed once read, reusing the cached model of every
 * project whose inputs did not change (`.noesis/cache/scanner/csharp/`); the
 * projection (app/code-model/projection) turns it into the system model by the
 * NoesisVision.Annotations vocabulary. Rules in
 * docs/plans/code-model-to-system-model.md; the cache in scanners/dotnet/README.md.
 */
export class CSharpSourceCodeScanner implements SourceCodeScanner {
  private readonly noesis: NoesisDir;
  private readonly now: Now;
  private readonly namespaces: NamespaceConfig;
  private readonly command: readonly string[];

  constructor({
    noesis,
    now,
    namespaces,
    command = DEFAULT_COMMAND,
  }: CSharpScannerDeps) {
    this.noesis = noesis;
    this.now = now;
    this.namespaces = namespaces;
    this.command = command;
  }

  /** Mints the id as the scan starts, so the newest scan has the highest id. */
  async scan(): Promise<SystemModel> {
    const id = SystemModelId.mint();
    const scannedAt = this.now();
    const root = this.noesis.root;
    const name = basename(root);
    const commit = await headCommit(root);

    const started = performance.now();
    const { manifest, files } = await this.runFirstStage(root, name);
    const scanned = performance.now();
    const { model, diagnostics } = projectSystemModel({
      manifest,
      files,
      vocabulary: CSHARP_VOCABULARY,
      config: this.namespaces,
    });
    const projected = performance.now();
    logDiagnostics(diagnostics);
    log.info(
      'Scanned {name}: {artifacts} artifacts in {scanMs} ms, projected {blocks} building blocks and {behaviours} behaviours in {projectMs} ms',
      {
        name,
        artifacts: files.length,
        scanMs: Math.round(scanned - started),
        blocks: model.buildingBlocks.length,
        behaviours: model.behaviours.length,
        projectMs: Math.round(projected - scanned),
      },
    );
    return { id, name, scanned_at: scannedAt, commit, ...model };
  }

  /** Runs the tool into a fresh tmp directory, reads what it wrote and removes it. */
  private async runFirstStage(
    root: string,
    name: string,
  ): Promise<{ manifest: ScanManifest; files: CodeModelFile[] }> {
    const outDir = this.noesis.resolve('tmp', randomUUID());
    try {
      return await this.runTool(root, name, outDir);
    } finally {
      await rm(outDir, { recursive: true, force: true });
    }
  }

  private async runTool(
    root: string,
    name: string,
    outDir: string,
  ): Promise<{ manifest: ScanManifest; files: CodeModelFile[] }> {
    const [executable, ...leading] = this.command;
    if (executable === undefined) {
      throw new Error('The C# scanner has no command to run.');
    }
    const args = [
      ...leading,
      root,
      '--out',
      outDir,
      '--repository-root',
      root,
      '--repository',
      name,
      '--cache',
      this.noesis.resolve(...CACHE_DIR),
    ];
    log.debug('Running {executable} {args}', { executable, args });
    const output = await run(executable, args, root);
    if (output.exitCode !== 0) {
      throw new Error(
        `${executable} failed with exit code ${output.exitCode}:\n${output.text.slice(-OUTPUT_TAIL)}`,
      );
    }
    return readCodeModel(join(outDir, MANIFEST));
  }
}

async function run(
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
      `Cannot run ${executable}: ${String(error)}. Install the .NET scanner (scanners/dotnet, \`dotnet tool install\`) so that it is on the PATH.`,
    );
  }
  const [stdout, stderr, exitCode] = await Promise.all([
    new Response(process.stdout).text(),
    new Response(process.stderr).text(),
    process.exited,
  ]);
  return { exitCode, text: `${stdout}${stderr}` };
}

async function readCodeModel(
  manifestPath: string,
): Promise<{ manifest: ScanManifest; files: CodeModelFile[] }> {
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

function logDiagnostics(diagnostics: readonly ProjectionDiagnostic[]): void {
  for (const { level, message, source } of diagnostics) {
    const where = source === null ? '' : ` ({path}:{line})`;
    log[level](`${message}${where}`, {
      path: source?.path,
      line: source?.line,
    });
  }
}
