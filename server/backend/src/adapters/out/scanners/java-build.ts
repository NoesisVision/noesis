import { access, constants } from 'node:fs/promises';
import { join } from 'node:path';
import type { JavaScannerEngine } from './repository-settings';

/** The plugins built and installed from scanners/java; pinned, because an unversioned prefix would take whatever is newest locally. */
export const JAVA_SCANNER_PLUGIN_VERSION = '0.1.0-SNAPSHOT';

/** The repository's own build wrapper (`mvnw`, `gradlew`) when it has an executable one, else the tool on the PATH. */
export async function wrapperOr(
  root: string,
  wrapper: string,
  tool: string,
): Promise<readonly string[]> {
  try {
    await access(join(root, wrapper), constants.X_OK);
    return [join(root, wrapper)];
  } catch {
    return [tool];
  }
}

/** The engine a Java preset runs: the one the settings name, else `source`. */
export function javaEngine(
  given: JavaScannerEngine | undefined,
): JavaScannerEngine {
  return given ?? 'source';
}
