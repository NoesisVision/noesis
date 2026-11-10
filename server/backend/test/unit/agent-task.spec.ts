import { describe, expect, it } from 'bun:test';
import {
  type AgentTask,
  invocationOf,
  promptOf,
  startsTask,
} from '#backend/app/agent/agent-task';

const design = {
  kind: 'design',
  change: '2026-09-17-weather',
} as AgentTask;
const revision = {
  kind: 'design',
  change: '2026-09-17-weather',
  designDoc: '2026-11-05-sketch',
} as AgentTask;
const diagram: AgentTask = {
  kind: 'diagram',
  diagram: { drawn: ['module|sales'], relations: ['contains'] },
};

describe('agent task', () => {
  it('invokes the plugin skill the page is about', () => {
    expect(invocationOf(design)).toBe(
      '/noesis:create-design-doc 2026-09-17-weather 1',
    );
    expect(invocationOf(revision)).toBe(
      '/noesis:update-design-doc 2026-09-17-weather 2026-11-05-sketch',
    );
    expect(invocationOf(diagram)).toBe('/noesis:explore-system-model');
  });

  it('starts the skill on a new place, and not on a follow-up in the same one', () => {
    expect(startsTask(design, null)).toBe(true);
    expect(startsTask(design, design)).toBe(false);
    expect(startsTask(revision, design)).toBe(true);
    expect(startsTask(diagram, design)).toBe(true);
    expect(
      startsTask(diagram, {
        kind: 'diagram',
        diagram: { drawn: [], relations: [] },
      }),
    ).toBe(false);
    expect(startsTask(undefined, design)).toBe(false);
  });

  it('writes the invocation first, then the words, then the files', () => {
    expect(
      promptOf(
        'Keep it small.',
        [{ name: 'a.md', path: '/s/a.md' }],
        design,
        true,
      ),
    ).toBe(
      '/noesis:create-design-doc 2026-09-17-weather 1\nKeep it small.\n\nAttached files (read them by path):\n- a.md: /s/a.md',
    );
    expect(promptOf('And then?', [], design, false)).toBe('And then?');
  });

  it('tells the agent how the diagram stands with every message about it', () => {
    const prompt = promptOf('Add what uses Order.', [], diagram, false);
    expect(prompt.startsWith('Add what uses Order.\n\nThe diagram now')).toBe(
      true,
    );
    expect(prompt).toContain(
      '{"drawn":["module|sales"],"relations":["contains"]}',
    );
  });
});
