import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { createUiApp } from '#backend/adapters/in/ui/ui.routes';
import { type TestNoesis, testNoesis } from './test-noesis';

let t: TestNoesis;
let app: ReturnType<typeof createUiApp>;

beforeEach(async () => {
  t = await testNoesis();
  app = createUiApp(t);
});

afterEach(() => t.cleanup());

const json = (body: unknown): RequestInit => ({
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify(body),
});

describe('ui agent routes', () => {
  it('answers the session whole', async () => {
    const response = await app.request('/agent');
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      session: {
        mode: 'embedded',
        status: 'idle',
        sessionId: null,
        hint: null,
        entries: [],
      },
    });
  });

  it('hands a message with its attachments to the agent and answers 202', async () => {
    const response = await app.request(
      '/agent/messages',
      json({
        text: '  Design it  ',
        attachments: [{ name: 'spec.md', path: '/scratch/uploads/spec.md' }],
      }),
    );
    expect(response.status).toBe(202);
    expect(t.agent.sent).toEqual([
      {
        text: 'Design it',
        attachments: [{ name: 'spec.md', path: '/scratch/uploads/spec.md' }],
      },
    ]);
    const { session } = (await response.json()) as {
      session: { entries: { kind: string; text?: string }[] };
    };
    expect(session.entries.map((entry) => entry.kind)).toEqual(['user']);
  });

  it('refuses an empty message', async () => {
    const response = await app.request('/agent/messages', json({ text: '  ' }));
    expect(response.status).toBe(400);
    expect(t.agent.sent).toEqual([]);
  });

  it('passes an answer, a decision and an interrupt through', async () => {
    const answered = await app.request(
      '/agent/answers',
      json({ toolUseId: 'toolu_1', answers: { 'How many?': 'One' } }),
    );
    expect(answered.status).toBe(200);
    expect(t.agent.answered).toEqual([
      { toolUseId: 'toolu_1', answers: { 'How many?': 'One' } },
    ]);

    const decided = await app.request(
      '/agent/decisions',
      json({ toolUseId: 'toolu_2', decision: 'allowAlways' }),
    );
    expect(decided.status).toBe(200);
    expect(t.agent.decided).toEqual([
      { toolUseId: 'toolu_2', decision: 'allowAlways' },
    ]);

    const interrupted = await app.request('/agent/interrupt', {
      method: 'POST',
    });
    expect(interrupted.status).toBe(200);
    expect(t.agent.interrupted).toBe(1);
  });

  it('refuses a decision that is not one of the three', async () => {
    const response = await app.request(
      '/agent/decisions',
      json({ toolUseId: 'toolu_2', decision: 'maybe' }),
    );
    expect(response.status).toBe(400);
  });

  it('keeps an uploaded file and answers the path the agent reads it by', async () => {
    const response = await app.request(
      '/agent/files',
      json({ name: 'notes.md', encoding: 'utf8', content: '# Notes\n' }),
    );
    expect(response.status).toBe(201);
    expect(await response.json()).toEqual({
      attachment: { name: 'notes.md', path: '/scratch/uploads/notes.md' },
    });
    expect(t.agent.saved).toHaveLength(1);
    expect(new TextDecoder().decode(t.agent.saved[0]?.bytes)).toBe('# Notes\n');
  });

  it('decodes a base64 upload', async () => {
    const response = await app.request(
      '/agent/files',
      json({ name: 'dot.png', encoding: 'base64', content: 'AQID' }),
    );
    expect(response.status).toBe(201);
    expect(Array.from(t.agent.saved[0]?.bytes ?? [])).toEqual([1, 2, 3]);
  });

  it('refuses a file name that is a path', async () => {
    const response = await app.request(
      '/agent/files',
      json({ name: '../escape.md', encoding: 'utf8', content: '' }),
    );
    expect(response.status).toBe(400);
    expect(t.agent.saved).toEqual([]);
  });

  it('streams the session, then every change, as server-sent events', async () => {
    const response = await app.request('/agent/events');
    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toContain('text/event-stream');
    const reader = response.body?.getReader();
    const decoder = new TextDecoder();
    const first = await reader?.read();
    expect(decoder.decode(first?.value)).toContain('event: session');

    await t.agent.host.send({ text: 'Hello', attachments: [] });
    const second = await reader?.read();
    const text = decoder.decode(second?.value);
    expect(text).toContain('event: session');
    expect(text).toContain('"text":"Hello"');
    await reader?.cancel();
  });
});
