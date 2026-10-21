import { rm } from 'node:fs/promises';
import { basename, dirname, join } from 'node:path';
import type { Now } from '#backend/app/clock';
import {
  type CodeModelFile,
  CodeModelFile as CodeModelFileSchema,
  type Language,
  ScanManifest,
} from '#backend/app/code-model/code-model';
import {
  type ProjectionDiagnostic,
  projectSystemModel,
} from '#backend/app/code-model/projection/project-system-model';
import type { AnnotationVocabulary } from '#backend/app/code-model/projection/vocabulary';
import type { SourceCodeScanner } from '#backend/app/system-model/source-code-scanner';
import type { SystemModel } from '#backend/app/system-model/system-model';
import { SystemModelId } from '#backend/app/system-model/system-model-id';
import { readJsonFile } from '#backend/platform/files/json-file';
import type { NoesisDir } from '#backend/platform/files/noesis-dir';
import { serverLogger } from '#backend/platform/logging/logging';
import { loadNoesisConfig } from './noesis-config';

const OUTPUT_TAIL = 4000;

export interface CodeModelScannerDeps {
  noesis: NoesisDir;
  now: Now;
  /** The first stage's command and leading arguments; the language's default tool unless given. */
  command?: readonly string[];
}

/**
 * A scanner in two stages: a language's own tool writes the common code model
 * into the session directory, and the projection (app/code-model/projection)
 * turns it into the system model by that language's annotation vocabulary.
 * Rules in docs/plans/code-model-to-system-model.md. A subclass says which
 * tool to run and how, and what to tell someone who does not have it.
 */
export abstract class CodeModelScanner implements SourceCodeScanner {
  private readonly log;

  protected constructor(
    protected readonly noesis: NoesisDir,
    protected readonly now: Now,
    protected readonly command: readonly string[],
    private readonly language: Language,
    private readonly vocabulary: AnnotationVocabulary,
  ) {
    this.log = serverLogger('scanner', language);
  }

  /** The arguments after the command's own: what the tool needs to scan `root` into `outDir` as `name`. */
  protected abstract firstStageArgs(
    root: string,
    name: string,
    outDir: string,
  ): readonly string[];

  /** What to do when the tool cannot be started. */
  protected abstract installHint(): string;

  /** The command for this repository; the configured one unless the repository ships its own wrapper. */
  protected async commandFor(_root: string): Promise<readonly string[]> {
    return this.command;
  }

  /** Mints the id as the scan starts, so the newest scan has the highest id. */
  async scan(): Promise<SystemModel> {
    const id = SystemModelId.mint();
    const scannedAt = this.now();
    const root = this.noesis.root;
    const name = basename(root);
    const outDir = this.noesis.resolve('sessions', 'scanner');

    const { namespaces: config } = await loadNoesisConfig(root);
    const started = performance.now();
    const { manifest, files } = await this.runFirstStage(root, name, outDir);
    const scanned = performance.now();
    const { model, diagnostics } = projectSystemModel({
      manifest,
      files,
      vocabulary: this.vocabulary,
      config,
    });
    const projected = performance.now();
    this.logDiagnostics(diagnostics);
    this.log.info(
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

  private manifestFile(): string {
    return join('code-model', this.language, 'manifest.json');
  }

  /** Runs the tool into an empty `outDir` and reads what it wrote. */
  private async runFirstStage(
    root: string,
    name: string,
    outDir: string,
  ): Promise<{ manifest: ScanManifest; files: CodeModelFile[] }> {
    const manifest = this.manifestFile();
    await rm(join(outDir, dirname(manifest)), { recursive: true, force: true });
    const [executable, ...leading] = await this.commandFor(root);
    if (executable === undefined) {
      throw new Error(`The ${this.language} scanner has no command to run.`);
    }
    const args = [...leading, ...this.firstStageArgs(root, name, outDir)];
    this.log.debug('Running {executable} {args}', { executable, args });
    const output = await this.run(executable, args, root);
    if (output.exitCode !== 0) {
      throw new Error(
        `${executable} failed with exit code ${output.exitCode}:\n${output.text.slice(-OUTPUT_TAIL)}`,
      );
    }
    return readCodeModel(join(outDir, manifest));
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

  private logDiagnostics(diagnostics: readonly ProjectionDiagnostic[]): void {
    for (const { level, message, source } of diagnostics) {
      const where = source === null ? '' : ` ({path}:{line})`;
      this.log[level](`${message}${where}`, {
        path: source?.path,
        line: source?.line,
      });
    }
  }
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
