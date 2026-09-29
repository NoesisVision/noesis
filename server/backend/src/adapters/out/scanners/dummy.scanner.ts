import type {
  ScannedSystemModel,
  SourceCodeScanner,
} from '#backend/app/system-model/source-code-scanner';

export class DummySourceCodeScanner implements SourceCodeScanner {
  scan(): Promise<ScannedSystemModel> {
    throw new Error('Not implemented');
  }
}
