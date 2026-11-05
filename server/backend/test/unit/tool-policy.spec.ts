import { describe, expect, it } from 'bun:test';
import { judgeToolUse } from '#backend/adapters/out/agent/tool-policy';
import type { AgentTask } from '#backend/app/agent/agent-task';

const scope = {
  pluginRoot: '/plugins/claude-code',
  repositoryRoot: '/repo',
};
const design = { kind: 'design', change: '2026-09-17-x' } as AgentTask;
const diagram: AgentTask = {
  kind: 'diagram',
  diagram: { drawn: [], relations: [] },
};

const allowed = (task: AgentTask | null, tool: string, input = {}) =>
  judgeToolUse(task, { tool, input }, scope).allowed;

describe('judgeToolUse', () => {
  it('lets Noesis tools, questions and the tool search through wherever the page is', () => {
    for (const task of [design, diagram, null]) {
      expect(
        allowed(task, 'mcp__plugin_noesis_noesis__get_newest_system_model'),
      ).toBe(true);
      expect(allowed(task, 'AskUserQuestion', { questions: [] })).toBe(true);
      expect(allowed(task, 'ToolSearch', { query: 'x' })).toBe(true);
    }
  });

  it('lets only the plugin’s own skills run', () => {
    expect(
      allowed(design, 'Skill', { skill: 'noesis:create-design-doc' }),
    ).toBe(true);
    expect(allowed(diagram, 'Skill', { skill: 'archify' })).toBe(false);
    expect(allowed(design, 'Skill', { skill: 'archify' })).toBe(false);
  });

  it('on the diagram refuses every file, script and search', () => {
    expect(allowed(diagram, 'Read', { file_path: '/repo/a.ts' })).toBe(false);
    expect(allowed(diagram, 'Bash', { command: 'ls' })).toBe(false);
    expect(allowed(diagram, 'WebSearch', { query: 'x' })).toBe(false);
    expect(
      allowed(diagram, 'Write', {
        file_path: '/repo/.noesis/sessions/s/x.json',
      }),
    ).toBe(false);
    const verdict = judgeToolUse(
      diagram,
      { tool: 'Read', input: { file_path: '/repo/a.ts' } },
      scope,
    );
    expect(verdict.allowed === false && verdict.reason).toContain(
      'get_system_model_graph',
    );
  });

  it('on a design lets the plugin’s files and the working files be read, and nothing else', () => {
    expect(
      allowed(design, 'Read', {
        file_path: '/plugins/claude-code/contracts/design-document.schema.json',
      }),
    ).toBe(true);
    expect(
      allowed(design, 'Read', {
        file_path: '/repo/.noesis/sessions/s/design-doc.json',
      }),
    ).toBe(true);
    expect(allowed(design, 'Read', { file_path: '/repo/src/Order.java' })).toBe(
      false,
    );
    expect(allowed(design, 'Grep', { pattern: 'x' })).toBe(true);
    expect(allowed(design, 'Grep', { pattern: 'x', path: '/repo/src' })).toBe(
      false,
    );
  });

  it('on a design lets only the working files be written', () => {
    expect(
      allowed(design, 'Write', {
        file_path: '/repo/.noesis/sessions/s/x.json',
      }),
    ).toBe(true);
    expect(
      allowed(design, 'Edit', { file_path: '.noesis/sessions/s/x.json' }),
    ).toBe(true);
    expect(allowed(design, 'Write', { file_path: '/repo/README.md' })).toBe(
      false,
    );
  });

  it('on a design runs the plugin’s scripts and reads the repository’s history, nothing else', () => {
    expect(
      allowed(design, 'Bash', {
        command:
          'bun "/plugins/claude-code/skills/update-design-doc/scripts/human-fields.ts" "/repo/.noesis/sessions/s/design-doc.json"',
      }),
    ).toBe(true);
    expect(
      allowed(design, 'Bash', {
        command: 'git log -1 --format=%cI 2>&1; git status --porcelain',
      }),
    ).toBe(true);
    expect(
      allowed(design, 'Bash', { command: 'rtk git status --porcelain' }),
    ).toBe(true);
    expect(allowed(design, 'Bash', { command: "python3 -I - <<'EOF'" })).toBe(
      false,
    );
    expect(allowed(design, 'Bash', { command: 'git log -1; rm -rf /' })).toBe(
      false,
    );
    expect(allowed(design, 'Bash', { command: 'find . -newer x' })).toBe(false);
  });

  it('refuses what no task asked for', () => {
    expect(allowed(null, 'WebFetch', { url: 'https://x' })).toBe(false);
    expect(allowed(design, 'TodoWrite', { todos: [] })).toBe(true);
  });
});
