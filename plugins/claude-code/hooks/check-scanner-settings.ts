import { readdir } from 'node:fs/promises';
import { join } from 'node:path';

const SETTINGS = '.noesis/settings.json';

const JAVA_BUILD_FILES = new Set([
  'pom.xml',
  'build.gradle',
  'build.gradle.kts',
  'settings.gradle',
  'settings.gradle.kts',
]);
const DOTNET_BUILD_FILE = /\.(sln|slnx|csproj)$/;

const SETUP_SKILLS = {
  java: 'the `setup-java-scanner` skill (a Maven or Gradle build is at the root)',
  dotnet:
    'the `setup-dotnet-scanner` skill (a .NET solution or project is at the root)',
} as const;

type Stack = keyof typeof SETUP_SKILLS;

/** What the session should know when `.noesis/settings.json` names no parser; null when it does. */
export async function scannerSetupNotice(
  projectDir: string,
): Promise<string | null> {
  const problem = await settingsProblem(projectDir);
  if (problem === null) return null;
  const stacks = await detectStacks(projectDir);
  return [
    `Noesis cannot scan this repository: ${problem}, so \`scan_system_model\` fails and designs have no system model to start from.`,
    `Tell the user once, briefly, early in the session, and offer to set up scanning with ${offerFor(stacks)}.`,
    `Do not edit build files or write ${SETTINGS} until the user agrees.`,
  ].join(' ');
}

async function settingsProblem(projectDir: string): Promise<string | null> {
  const file = Bun.file(join(projectDir, SETTINGS));
  if (!(await file.exists())) return `${SETTINGS} is missing`;
  const settings = parseJson(await file.text());
  if (settings === undefined) return `${SETTINGS} is not valid JSON`;
  return namesParser(settings) ? null : `${SETTINGS} names no "parser"`;
}

async function detectStacks(projectDir: string): Promise<Stack[]> {
  const names = await readdir(projectDir);
  const stacks: Stack[] = [];
  if (names.some((name) => JAVA_BUILD_FILES.has(name))) stacks.push('java');
  if (names.some((name) => DOTNET_BUILD_FILE.test(name))) stacks.push('dotnet');
  return stacks;
}

function offerFor(stacks: Stack[]): string {
  if (stacks.length > 0) {
    return stacks.map((stack) => SETUP_SKILLS[stack]).join(' or ');
  }
  return 'the skill for its stack, after asking the user which it is: the `setup-java-scanner` skill for Java with Maven or Gradle, the `setup-dotnet-scanner` skill for C# and .NET';
}

function namesParser(settings: unknown): boolean {
  if (typeof settings !== 'object' || settings === null) return false;
  const parser: unknown = (settings as Record<string, unknown>).parser;
  if (typeof parser !== 'object' || parser === null) return false;
  return typeof (parser as Record<string, unknown>).language === 'string';
}

/** The parsed value, or undefined when the text is not JSON. */
function parseJson(text: string): unknown {
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return undefined;
  }
}

async function main(): Promise<void> {
  const projectDir = process.env.CLAUDE_PROJECT_DIR ?? process.cwd();
  const notice = await scannerSetupNotice(projectDir);
  if (notice === null) return;
  console.log(
    JSON.stringify({
      systemMessage: `Noesis: scanning is not configured in ${SETTINGS}.`,
      hookSpecificOutput: {
        hookEventName: 'SessionStart',
        additionalContext: notice,
      },
    }),
  );
}

if (import.meta.main) {
  try {
    await main();
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}
