import { copyFileSync, renameSync, statSync, unlinkSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { serverLogger } from '#backend/platform/logging/logging';

const log = serverLogger('native');

const BINARY_NAME = 'lbugjs.node';

/**
 * `@ladybugdb/core` ships the binary in a per-platform optional package and
 * copies it into its own directory from a postinstall script. bun runs
 * postinstall only for packages the *root* project trusts, and a `bunx
 * @noesis-vision/noesis` install has no root project to trust anything — so
 * the copy never happens and the first `require` dies on a missing file. This
 * does the postinstall's job at boot instead, once, only when it is missing.
 * Must run before the first import of `@ladybugdb/core` (DatabaseService
 * loads it lazily for exactly that reason).
 */
export function ensureLadybugBinary(): void {
  const corePackage = createRequire(import.meta.url).resolve(
    '@ladybugdb/core/package.json',
  );
  const binary = NativeBinary.at(join(dirname(corePackage), BINARY_NAME));

  const platformPackage = `@ladybugdb/core-${process.platform}-${process.arch}`;
  // Resolved from the core package rather than from here: the platform build
  // is core's optional dependency, and bun's store layout does not put it
  // anywhere this module can see.
  const source = resolvePlatformBinary(
    createRequire(corePackage),
    platformPackage,
  );
  if (source === null) {
    // A binary already in place was vendored or installed by the postinstall
    // this exists to stand in for; only its absence is a problem.
    if (binary.exists) return;
    throw new Error(
      `LadybugDB has no prebuilt binary for ${process.platform}-${process.arch} (${platformPackage} is not installed).`,
    );
  }

  if (binary.isCopyOf(source)) return;
  binary.installFrom(source);
  log.info('installed the LadybugDB binary from {platformPackage}', {
    platformPackage,
  });
}

/**
 * The file `@ladybugdb/core` loads, and the rules for putting it there. Two
 * boots can race for it — the SDK's protocol-era probe runs a second process
 * from the same command — and either may be killed part-way through.
 */
export class NativeBinary {
  readonly path: string;

  private constructor(path: string) {
    this.path = path;
  }

  static at(path: string): NativeBinary {
    return new NativeBinary(path);
  }

  get exists(): boolean {
    return sizeOf(this.path) !== null;
  }

  /**
   * Size alone: the damage this guards against is a truncated copy, and a
   * short file is what a killed copy leaves. Re-copying repairs an install
   * that a previous boot cut short.
   */
  isCopyOf(source: string): boolean {
    const installed = sizeOf(this.path);
    return installed !== null && installed === sizeOf(source);
  }

  /**
   * Stages beside the target and renames onto it. The rename is atomic within
   * the one directory, so a process killed mid-copy leaves a stray temp file
   * instead of a short binary that every later boot would trust and load.
   */
  installFrom(source: string): void {
    const staged = `${this.path}.${process.pid}.tmp`;
    try {
      copyFileSync(source, staged);
      renameSync(staged, this.path);
    } catch (error) {
      removeIfPresent(staged);
      throw error;
    }
  }
}

function resolvePlatformBinary(
  require: ReturnType<typeof createRequire>,
  platformPackage: string,
): string | null {
  try {
    const dir = dirname(require.resolve(`${platformPackage}/package.json`));
    return join(dir, BINARY_NAME);
  } catch {
    return null;
  }
}

function sizeOf(path: string): number | null {
  try {
    return statSync(path).size;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null;
    throw error;
  }
}

function removeIfPresent(path: string): void {
  try {
    unlinkSync(path);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
  }
}
