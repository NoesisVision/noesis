import { CSharpParser } from '#backend/adapters/out/scanners/code-parsers/csharp-parser';
import { JavaParser } from '#backend/adapters/out/scanners/code-parsers/java-parser';
import type { CreateCodeParser } from '#backend/app/scanners/scanner-factory';
import type { NoesisDir } from '#backend/platform/files/noesis-dir';

/** The parsers `.noesis/settings.json` can name, each built from its own settings. */
export function codeParserFor(noesis: NoesisDir): CreateCodeParser {
  return (settings) => {
    switch (settings.language) {
      case 'csharp':
        return new CSharpParser({ noesis });
      case 'java':
        return new JavaParser({ noesis, settings });
    }
  };
}
