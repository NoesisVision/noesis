import type {
  ScannedSystemModel,
  SourceCodeScanner,
} from '#backend/app/system-model/source-code-scanner';

export class CSharpSourceCodeScanner implements SourceCodeScanner {
  scan(): Promise<ScannedSystemModel> {
    throw new Error('Not implemented');
  }
}
