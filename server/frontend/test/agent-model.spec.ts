import { describe, expect, it } from 'bun:test';
import {
  designTaskOf,
  isTextFile,
  safeFileName,
  taskVerb,
  toolLabel,
} from '../src/features/agent/agent.model';

describe('agent model', () => {
  it('reads what the page is about from its address', () => {
    expect(designTaskOf({})).toBeUndefined();
    expect(designTaskOf({ changeId: '2026-09-17-x' })).toEqual({
      change: '2026-09-17-x',
    } as never);
    expect(
      designTaskOf({ changeId: '2026-09-17-x', docId: '2026-11-05-y' }),
    ).toEqual({ change: '2026-09-17-x', designDoc: '2026-11-05-y' } as never);
  });

  it('names what a task does', () => {
    expect(taskVerb({ change: '2026-09-17-x' } as never)).toBe(
      'New design document',
    );
    expect(
      taskVerb({ change: '2026-09-17-x', designDoc: '2026-11-05-y' } as never),
    ).toBe('Revising the design document');
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
