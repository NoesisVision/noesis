import type { ParseManifestHeader } from './code-model';

/** The skill that installs or updates the parser of a language, where one exists. */
const SETUP_SKILLS: Record<string, string> = {
  java: 'setup-java-scanner',
  csharp: 'setup-dotnet-scanner',
};

/**
 * Compares the code model schema a parser wrote with the one this service
 * reads: `null` when they are the same, else the refusal, saying which side
 * is behind. Only the schema is compared: the service knows no parser
 * version, so any parser release writing the schema it reads is accepted.
 * The parser's name and version come from its own manifest, so the refusal
 * names what to update.
 */
export function checkCodeModelSchema(
  { schemaVersion: written, generator, language }: ParseManifestHeader,
  reads: number,
): string | null {
  if (written === reads) return null;
  const found = `${generator.name} ${generator.version} wrote code model schema ${written}; this Noesis plugin reads schema ${reads}.`;
  if (written > reads) {
    return `${found} Update the plugin (/plugin update noesis-beta@noesis), or pin the parser to a release that writes schema ${reads} (its README lists them).`;
  }
  const skill = SETUP_SKILLS[language];
  return skill === undefined
    ? `${found} Update the parser to a release that writes schema ${reads}.`
    : `${found} Update the parser with the ${skill} skill.`;
}
