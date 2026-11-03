import { describe, expect, it } from 'bun:test';
import { systemModelTools } from '../src/features/system-model/ui/use-system-model-tools';
import {
  type ModelContext,
  registerTools,
} from '../src/shared/web-mcp/web-mcp';

/** The way to the exploration as an agent calls it, its tools offered or not. */
function openTool(ready: boolean) {
  const calls: string[] = [];
  const tools = new Map<string, (input: unknown) => Promise<string>>();
  const context: ModelContext = {
    registerTool: (tool) => void tools.set(tool.name, tool.execute),
  };
  registerTools(
    systemModelTools(
      async () => void calls.push('open'),
      async () => {
        calls.push('ready');
        return ready;
      },
    ),
    context,
  );
  const open = tools.get('open_system_model_exploration');
  if (open === undefined) throw new Error('not offered');
  return { calls, open: () => open({}) };
}

describe('the way to the system model offered to an agent', () => {
  it('opens the exploration, then answers once its tools are offered', async () => {
    const { calls, open } = openTool(true);
    expect(await open()).toContain('its tools are offered');
    expect(calls).toEqual(['open', 'ready']);
  });

  it('says why when the exploration offers no tools in time', async () => {
    const { open } = openTool(false);
    const answer = await open();
    expect(answer).toContain('not offered within 10 seconds');
    expect(answer).toContain('not have been scanned');
  });
});
