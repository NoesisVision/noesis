import { describe, expect, it } from 'bun:test';
import { type AgentSession } from '#backend/app/agent/agent-session';
import { AgentTranscript } from '#backend/app/agent/agent-transcript';
import { fixedClock } from '../support/fixed-clock';
import { NOW } from './test-noesis';

const transcript = () =>
  new AgentTranscript('embedded', 'starting', fixedClock(NOW));

describe('AgentTranscript', () => {
  it('stamps every entry with an id and the clock', () => {
    const t = transcript();
    const entry = t.append({ kind: 'note', text: 'hi', severity: 'info' });
    expect(entry.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(entry.at).toBe(NOW);
    expect(t.view().entries).toEqual([entry]);
  });

  it('replaces one entry by its id and leaves the rest', () => {
    const t = transcript();
    const a = t.append({ kind: 'assistant', text: 'He', streaming: true });
    const b = t.append({ kind: 'note', text: 'n', severity: 'info' });
    t.update(a.id, (entry) => ({ ...entry, text: 'Hello', streaming: false }));
    t.update('nope', (entry) => ({ ...entry, id: 'x' }));
    const [first, second] = t.view().entries;
    expect(first).toMatchObject({ id: a.id, text: 'Hello', streaming: false });
    expect(second).toEqual(b);
    expect(t.view().entries).toHaveLength(2);
  });

  it('finds an entry of a kind by what it holds', () => {
    const t = transcript();
    t.append({
      kind: 'permission',
      toolUseId: 'toolu_1',
      tool: 'Bash',
      summary: 'ls',
      detail: 'ls -la',
      decision: null,
    });
    expect(
      t.find('permission', (entry) => entry.toolUseId === 'toolu_1')?.tool,
    ).toBe('Bash');
    expect(t.find('question', () => true)).toBeUndefined();
  });

  it('tells listeners once per tick, with the session as it stands then', async () => {
    const t = transcript();
    const seen: AgentSession[] = [];
    const unsubscribe = t.subscribe((session) => seen.push(session));
    t.setStatus('working');
    t.append({ kind: 'note', text: 'one', severity: 'info' });
    t.append({ kind: 'note', text: 'two', severity: 'info' });
    expect(seen).toEqual([]);
    await Bun.sleep(60);
    expect(seen).toHaveLength(1);
    expect(seen[0]?.status).toBe('working');
    expect(seen[0]?.entries.map((entry) => entry.kind)).toEqual([
      'note',
      'note',
    ]);
    unsubscribe();
    t.setStatus('idle');
    await Bun.sleep(60);
    expect(seen).toHaveLength(1);
  });
});
