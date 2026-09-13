import { copyFileSync, existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { serverLogger } from '../logging/logging.js';

const log = serverLogger('native');

/**
 * Puts LadybugDB's native binary where its loader expects it.
 *
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
  const require = createRequire(import.meta.url);
  const coreDir = dirname(require.resolve('@ladybugdb/core/package.json'));
  const target = join(coreDir, 'lbugjs.node');
  if (existsSync(target)) return;

  const platformPackage = `@ladybugdb/core-${process.platform}-${process.arch}`;
  let source: string;
  try {
    source = join(
      dirname(require.resolve(`${platformPackage}/package.json`)),
      'lbugjs.node',
    );
  } catch {
    throw new Error(
      `LadybugDB has no prebuilt binary for ${process.platform}-${process.arch} (${platformPackage} is not installed).`,
    );
  }
  copyFileSync(source, target);
  log.info('installed the LadybugDB binary from {platformPackage}', {
    platformPackage,
  });
}
