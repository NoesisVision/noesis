import { CSharpCodeParser } from '#backend/adapters/out/scanner/parsers/csharp-code-parser';
import { JavaCodeParser } from '#backend/adapters/out/scanner/parsers/java-code-parser';
import type { CodeParsers } from '#backend/app/scanner/scanner-factory';
import type { NoesisDir } from '#backend/platform/files/noesis-dir';

/** The parsers `.noesis/settings.json` can name, each built from the settings it reads. */
export function codeParsers(noesis: NoesisDir): CodeParsers {
  return {
    csharp: () => new CSharpCodeParser({ noesis }),
    'code-model': ({ codeModel }) => new JavaCodeParser({ noesis, codeModel }),
  };
}
