import { rm } from 'node:fs/promises';
import { basename, dirname, join } from 'node:path';
import type { Now } from '#backend/app/clock';
import {
  type CodeModelFile,
  CodeModelFile as CodeModelFileSchema,
  ScanManifest,
} from '#backend/app/code-model/code-model';
import { CSHARP_VOCABULARY } from '#backend/app/code-model/projection/csharp.vocabulary';
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
import { loadRepositorySettings } from '../repository-settings';

/** The `dotnet tool`, on the PATH of the machine the server runs on. */
const DEFAULT_COMMAND = ['noesis-scan-csharp'];
/** Where the tool writes under `--out`. */
const MANIFEST = join('code-model', 'csharp', 'manifest.json');
const OUTPUT_TAIL = 4000;

const log = serverLogger('scanner', 'csharp');

export interface CSharpScannerDeps {
  noesis: NoesisDir;
  now: Now;
  /** The first stage's command and leading arguments; `noesis-scan-csharp` unless given. */
  command?: readonly string[];
}

/**
 * The C# scanner in two stages: `noesis-scan-csharp` (scanners/dotnet) reads
 * the solution with Roslyn and writes the code model into the session
 * directory; the projection (app/code-model/projection) turns it into the
 * system model by the NoesisVision.Annotations vocabulary. Rules in
 * docs/plans/code-model-to-system-model.md.
 */
export class CSharpSourceCodeScanner implements SourceCodeScanner {
  private readonly noesis: NoesisDir;
  private readonly now: Now;
  private readonly command: readonly string[];

  constructor({ noesis, now, command = DEFAULT_COMMAND }: CSharpScannerDeps) {
    this.noesis = noesis;
    this.now = now;
    this.command = command;
  }

  /** Mints the id as the scan starts, so the newest scan has the highest id. */
  async scan(): Promise<SystemModel> {
    const id = SystemModelId.mint();
    const scannedAt = this.now();
    const root = this.noesis.root;
    const name = basename(root);
    const outDir = this.noesis.resolve('sessions', 'scanner');

    const { namespaces: config } = await loadRepositorySettings(this.noesis);
    const started = performance.now();
    const { manifest, files } = await this.runFirstStage(root, name, outDir);
    const scanned = performance.now();
    const { model, diagnostics } = projectSystemModel({
      manifest,
      files,
      vocabulary: CSHARP_VOCABULARY,
      config,
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
    return { id, name, scanned_at: scannedAt, ...model };
  }

  /** Runs the tool into an empty `outDir` and reads what it wrote. */
  private async runFirstStage(
    root: string,
    name: string,
    outDir: string,
  ): Promise<{ manifest: ScanManifest; files: CodeModelFile[] }> {
    await rm(join(outDir, dirname(MANIFEST)), { recursive: true, force: true });
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
