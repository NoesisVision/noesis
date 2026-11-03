import { describe, expect, it } from 'bun:test';
import { z } from 'zod';
import {
  type ModelContext,
  registerTools,
  ToolRefusal,
  webTool,
  whenOffered,
} from '../src/shared/web-mcp/web-mcp';

type Registered = Parameters<ModelContext['registerTool']>;

/** A model context that keeps what is registered with it. */
function fakeContext() {
  const registered: Registered[] = [];
  const context: ModelContext = {
    registerTool: (...args) => {
      registered.push(args);
    },
  };
  return { context, registered };
}

const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

const echo = webTool({
  name: 'echo',
  description: 'Says back what it is given.',
  readOnly: true,
  input: z.object({ word: z.string().describe('What to say back.') }),
  run: ({ word }) => ({ said: word }),
});

describe('Offering tools through WebMCP', () => {
  it('registers each tool with its input as JSON Schema', async () => {
    const { context, registered } = fakeContext();
    registerTools([echo], context);
    await settle();
    const [[tool]] = registered as [Registered];
    expect(tool.name).toBe('echo');
    expect(tool.description).toBe('Says back what it is given.');
    expect(tool.annotations).toEqual({ readOnlyHint: true });
    expect(tool.inputSchema).toEqual({
      type: 'object',
      properties: {
        word: { type: 'string', description: 'What to say back.' },
      },
      required: ['word'],
    });
  });

  it('runs a tool on input it checks, and answers in JSON', async () => {
    const { context, registered } = fakeContext();
    registerTools([echo], context);
    await settle();
    const [[tool]] = registered as [Registered];
    expect(await tool.execute({ word: 'hi' })).toBe('{"said":"hi"}');
    // An older draft hands the input over as JSON text.
    expect(await tool.execute('{"word":"yo"}')).toBe('{"said":"yo"}');
    const wrong = JSON.parse(await tool.execute({ word: 3 }));
    expect(wrong.error).toContain('word');
  });

  it('hands a refusal to the agent rather than throwing it', async () => {
    const { context, registered } = fakeContext();
    registerTools(
      [
        webTool({
          name: 'no',
          description: 'Refuses.',
          input: z.object({}),
          run: () => {
            throw new ToolRefusal('Not today.');
          },
        }),
      ],
      context,
    );
    await settle();
    const [[tool]] = registered as [Registered];
    expect(await tool.execute({})).toBe('{"error":"Not today."}');
    expect(tool.annotations).toEqual({ readOnlyHint: false });
  });

  it('takes the tools back by aborting the signal they were offered with', async () => {
    const { context, registered } = fakeContext();
    const takeBack = registerTools([echo, echo], context);
    await settle();
    const signals = registered.map(([, options]) => options?.signal);
    expect(signals.every((signal) => signal?.aborted === false)).toBe(true);
    takeBack();
    expect(signals.every((signal) => signal?.aborted === true)).toBe(true);
  });

  it('offers nothing, and fails at nothing, without a model context', () => {
    const takeBack = registerTools([echo], null);
    expect(() => takeBack()).not.toThrow();
  });
});

describe('Offering tools taken back at once', () => {
  it('registers each at once, and keeps quiet when one is refused for being taken back', async () => {
    const offered: string[] = [];
    const context: ModelContext = {
      registerTool: (tool, options) => {
        offered.push(tool.name);
        return new Promise((_, reject) =>
          options?.signal?.addEventListener('abort', () =>
            reject(new DOMException('aborted', 'AbortError')),
          ),
        );
      },
    };
    // As React's strict mode does to an effect: offered, taken back, offered.
    registerTools([echo], context)();
    registerTools([echo], context);
    expect(offered).toEqual(['echo', 'echo']);
    await settle();
  });
});

describe('Waiting for a tool to be offered', () => {
  const named = (name: string) =>
    webTool({ name, description: name, input: z.object({}), run: () => '' });
  const resolving: ModelContext = { registerTool: async () => {} };

  it('resolves once the browser has registered it, and at once after', async () => {
    const waiting = whenOffered('late', 1000);
    const takeBack = registerTools([named('late')], resolving);
    expect(await waiting).toBe(true);
    expect(await whenOffered('late', 0)).toBe(true);
    takeBack();
  });

  it('gives up after its time, and forgets a tool taken back', async () => {
    expect(await whenOffered('never', 10)).toBe(false);
    const takeBack = registerTools([named('gone')], resolving);
    expect(await whenOffered('gone', 1000)).toBe(true);
    takeBack();
    expect(await whenOffered('gone', 10)).toBe(false);
  });
});
