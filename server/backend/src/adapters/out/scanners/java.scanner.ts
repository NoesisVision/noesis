import type { SourceCodeScanner } from '#backend/app/system-model/source-code-scanner';
import type { SystemModel } from '#backend/app/system-model/system-model';

export class JavaSourceCodeScanner implements SourceCodeScanner {
  scan(): Promise<SystemModel> {
    throw new Error('Not implemented');
  }
}
