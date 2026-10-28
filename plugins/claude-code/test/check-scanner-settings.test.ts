import { afterEach, beforeEach, expect, test } from 'bun:test';
import { spawnSync } from 'node:child_process';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { scannerSetupNotice } from '../hooks/check-scanner-settings';

const pluginRoot = fileURLToPath(new URL('../', import.meta.url));
const script = join(pluginRoot, 'hooks/check-scanner-settings.ts');

let projectDir: string;

beforeEach(async () => {
  projectDir = await mkdtemp(join(tmpdir(), 'noesis-hook-'));
});

afterEach(async () => {
  await rm(projectDir, { recursive: true, force: true });
});

async function writeSettings(text: string): Promise<void> {
  await mkdir(join(projectDir, '.noesis'), { recursive: true });
  await writeFile(join(projectDir, '.noesis/settings.json'), text);
}

test('says nothing when the settings name a parser', async () => {
  await writeSettings(JSON.stringify({ parser: { language: 'csharp' } }));
  expect(await scannerSetupNotice(projectDir)).toBeNull();
});

test('offers the Java setup when the settings are missing in a Maven build', async () => {
  await writeFile(join(projectDir, 'pom.xml'), '<project/>');
  const notice = await scannerSetupNotice(projectDir);
  expect(notice).toContain('.noesis/settings.json is missing');
  expect(notice).toContain('setup-java-scanner');
  expect(notice).not.toContain('setup-dotnet-scanner');
});

test('offers the .NET setup when the settings name no parser in a solution', async () => {
  await writeFile(join(projectDir, 'Shop.sln'), '');
  await writeSettings(JSON.stringify({ namespacesToExclude: [] }));
  const notice = await scannerSetupNotice(projectDir);
  expect(notice).toContain('names no "parser"');
  expect(notice).toContain('setup-dotnet-scanner');
  expect(notice).not.toContain('setup-java-scanner');
});

test('reports settings that are not JSON', async () => {
  await writeFile(join(projectDir, 'build.gradle.kts'), '');
  await writeSettings('{ "parser": ');
  const notice = await scannerSetupNotice(projectDir);
  expect(notice).toContain('is not valid JSON');
  expect(notice).toContain('setup-java-scanner');
});

test('asks for the stack when no build is at the root', async () => {
  const notice = await scannerSetupNotice(projectDir);
  expect(notice).toContain('after asking the user');
  expect(notice).toContain('setup-java-scanner');
  expect(notice).toContain('setup-dotnet-scanner');
});

test('the hook prints SessionStart context for the project Claude Code runs in', () => {
  const run = spawnSync('bun', [script], {
    env: { ...process.env, CLAUDE_PROJECT_DIR: projectDir },
    encoding: 'utf8',
  });
  expect(run.status).toBe(0);
  const output = JSON.parse(run.stdout) as {
    hookSpecificOutput: { hookEventName: string; additionalContext: string };
  };
  expect(output.hookSpecificOutput.hookEventName).toBe('SessionStart');
  expect(output.hookSpecificOutput.additionalContext).toContain(
    '.noesis/settings.json is missing',
  );
});

test('the hook prints nothing once scanning is configured', async () => {
  await writeSettings(
    JSON.stringify({ parser: { language: 'java', command: ['./mvnw'] } }),
  );
  const run = spawnSync('bun', [script], {
    env: { ...process.env, CLAUDE_PROJECT_DIR: projectDir },
    encoding: 'utf8',
  });
  expect(run.status).toBe(0);
  expect(run.stdout).toBe('');
});

test('hooks.json runs the check at session start from the plugin root', async () => {
  const config = JSON.parse(
    await readFile(join(pluginRoot, 'hooks/hooks.json'), 'utf8'),
  ) as {
    hooks: { SessionStart: { hooks: { type: string; command: string }[] }[] };
  };
  const [entry] = config.hooks.SessionStart;
  expect(entry?.hooks).toEqual([
    expect.objectContaining({
      type: 'command',
      command: 'bun "${CLAUDE_PLUGIN_ROOT}/hooks/check-scanner-settings.ts"',
    }),
  ]);
});
