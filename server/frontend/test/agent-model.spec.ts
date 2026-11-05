import { describe, expect, it } from 'bun:test';
import type { AgentTask } from '#backend/app/agent/agent-task.ts';
import {
  isTextFile,
  safeFileName,
  taskPlaceholder,
  taskVerb,
  toolLabel,
} from '../src/features/agent/agent.model';

const design = { kind: 'design', change: '2026-09-17-x' } as AgentTask;
const revision = {
  kind: 'design',
  change: '2026-09-17-x',
  designDoc: '2026-11-05-y',
} as AgentTask;
const diagram: AgentTask = {
  kind: 'diagram',
  diagram: { drawn: [], relations: [] },
};

describe('agent model', () => {
  it('names what a task does', () => {
    expect(taskVerb(design)).toBe('New design document');
    expect(taskVerb(revision)).toBe('Revising the design document');
    expect(taskVerb(diagram)).toBe('Composing the diagram');
  });

  it('asks for what the message will do', () => {
    expect(taskPlaceholder(undefined)).toBe('Ask the agent…');
    expect(taskPlaceholder(design)).toBe('What should the design cover?');
    expect(taskPlaceholder(revision)).toBe('What should change in the design?');
    expect(taskPlaceholder(diagram)).toBe('What should the diagram show?');
  });

  it('reads a file as text by its type, else by its name', () => {
    expect(isTextFile({ name: 'a.md', type: '' })).toBe(true);
    expect(isTextFile({ name: 'a.bin', type: 'text/plain' })).toBe(true);
    expect(isTextFile({ name: 'a.png', type: 'image/png' })).toBe(false);
  });

  it('keeps a file name to one safe segment', () => {
    expect(safeFileName('My notes (v2).md')).toBe('My-notes-v2-.md');
    expect(safeFileName('../etc/passwd')).toBe('etc-passwd');
    expect(safeFileName('???')).toBe('file');
  });

  it('shortens an MCP tool name to the tool', () => {
    expect(toolLabel('mcp__plugin_noesis_noesis__list_changes')).toBe(
      'list_changes',
    );
    expect(toolLabel('Bash')).toBe('Bash');
  });
});
