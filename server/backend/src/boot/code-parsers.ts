import { CSharpCodeParser } from '#backend/adapters/out/parsers/csharp-code-parser';
import { JavaCodeParser } from '#backend/adapters/out/parsers/java-code-parser';
import type { CodeParsers } from '#backend/app/scanner/system-model/scanner-factory';
import type { NoesisDir } from '#backend/platform/files/noesis-dir';

/** The parsers the scanners `.noesis/settings.json` can name, each built from the settings it reads. */
export function codeParsers(noesis: NoesisDir): CodeParsers {
  return {
    csharp: () => new CSharpCodeParser({ noesis }),
    'code-model': ({ codeModel }) => new JavaCodeParser({ noesis, codeModel }),
  };
}
