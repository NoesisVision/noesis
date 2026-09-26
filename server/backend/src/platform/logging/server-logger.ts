import { getLogger, type Logger } from '@logtape/logtape';

// Free of Node APIs: the ui routes import it, and the frontend type-checks
// their route tree.

export const ROOT_CATEGORY = 'noesis';

export function serverLogger(...segments: string[]): Logger {
  return getLogger([ROOT_CATEGORY, 'server', ...segments]);
}
