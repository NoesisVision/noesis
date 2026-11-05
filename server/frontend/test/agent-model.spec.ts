import { describe, expect, it } from 'bun:test';
import {
  createDesignDocPrompt,
  isTextFile,
  safeFileName,
  toolLabel,
  updateDesignDocPrompt,
} from '../src/features/agent/agent.model';

describe('agent model', () => {
  it('invokes the plugin’s skills by their namespaced names', () => {
    expect(createDesignDocPrompt('2026-09-17-x')).toBe(
      '/noesis:create-design-doc 2026-09-17-x 1',
    );
    expect(updateDesignDocPrompt('2026-09-17-x', '2026-11-05-y')).toBe(
      '/noesis:update-design-doc 2026-09-17-x 2026-11-05-y ',
    );
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
