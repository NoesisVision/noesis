import type { SourceCodeScanner } from '#backend/app/system-model/source-code-scanner';
import type { SystemModel } from '#backend/app/system-model/system-model';

export class DummySourceCodeScanner implements SourceCodeScanner {
  scan(): Promise<SystemModel> {
    throw new Error('Not implemented');
  }
}
