import { CSharpCodeParser } from '#backend/adapters/out/scanner/parsers/csharp-code-parser';
import { JavaCodeParser } from '#backend/adapters/out/scanner/parsers/java-code-parser';
import type { CreateCodeParser } from '#backend/app/scanner/scanner-factory';
import type { NoesisDir } from '#backend/platform/files/noesis-dir';

/** The parsers `.noesis/settings.json` can name, each built from its own settings. */
export function codeParserFor(noesis: NoesisDir): CreateCodeParser {
  return (settings) => {
    switch (settings.language) {
      case 'csharp':
        return new CSharpCodeParser({ noesis });
      case 'java':
        return new JavaCodeParser({ noesis, settings });
    }
  };
}
