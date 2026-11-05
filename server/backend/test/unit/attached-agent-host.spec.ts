import { describe, expect, it } from 'bun:test';
import { Client } from '@modelcontextprotocol/client';
import { InMemoryTransport } from '@modelcontextprotocol/server';
import { AttachedAgentHost } from '#backend/adapters/in/mcp/attached-agent-host';
import { ChannelLink } from '#backend/adapters/in/mcp/channel-link';
import { createMcpServer } from '#backend/adapters/in/mcp/mcp-server';
import { SessionDir } from '#backend/adapters/in/mcp/session-dir';
import { REPLY_TO_NOESIS_PAGE } from '#backend/adapters/in/mcp/tool-names';
import { AgentTranscript } from '#backend/app/agent/agent-transcript';
import { fixedClock } from '../support/fixed-clock';
import { NOW, testNoesis } from './test-noesis';

describe('AttachedAgentHost', () => {
  it('says the message went nowhere while no host is connected', async () => {
    const transcript = new AgentTranscript('attached', 'idle', fixedClock(NOW));
    const host = new AttachedAgentHost(transcript, new ChannelLink());
    await host.send({ text: 'Hello', attachments: [] });
    const kinds = transcript.view().entries.map((entry) => entry.kind);
    expect(kinds).toEqual(['user', 'note']);
    expect(transcript.view().hint).toContain('channel');
  });

  it('answers the page through the reply tool, which the server offers only when attached', async () => {
    const noesis = await testNoesis();
    const files = await new SessionDir(noesis.noesis).open();
    const transcript = new AgentTranscript('attached', 'idle', fixedClock(NOW));
    const channel = new ChannelLink();
    const host = new AttachedAgentHost(transcript, channel);
    const server = createMcpServer({
      ...noesis,
      version: '0.0.0-test',
      noesis: noesis.noesis,
      sessionFiles: files,
      replies: host,
    });
    channel.attach(server);
    const client = new Client({ name: 'spec', version: '0' });
    const [clientSide, serverSide] = InMemoryTransport.createLinkedPair();
    await Promise.all([server.connect(serverSide), client.connect(clientSide)]);
    try {
      const { tools } = await client.listTools();
      expect(tools.map((tool) => tool.name)).toContain(REPLY_TO_NOESIS_PAGE);
      expect(server.server.getCapabilities()?.experimental).toEqual({
        'claude/channel': {},
      });

      await host.send({ text: 'Hello', attachments: [] });
      await client.callTool({
        name: REPLY_TO_NOESIS_PAGE,
        arguments: { text: 'Hi back' },
      });
      expect(
        transcript
          .view()
          .entries.map((entry) => [
            entry.kind,
            entry.kind === 'note' ? entry.text : '',
          ]),
      ).toEqual([
        ['user', ''],
        ['assistant', ''],
      ]);
    } finally {
      await client.close();
      await noesis.cleanup();
    }
  });

  it('offers no reply tool to a session the page did not attach to', async () => {
    const noesis = await testNoesis();
    const files = await new SessionDir(noesis.noesis).open();
    const server = createMcpServer({
      ...noesis,
      version: '0.0.0-test',
      noesis: noesis.noesis,
      sessionFiles: files,
    });
    const client = new Client({ name: 'spec', version: '0' });
    const [clientSide, serverSide] = InMemoryTransport.createLinkedPair();
    await Promise.all([server.connect(serverSide), client.connect(clientSide)]);
    try {
      const { tools } = await client.listTools();
      expect(tools.map((tool) => tool.name)).not.toContain(
        REPLY_TO_NOESIS_PAGE,
      );
      expect(server.server.getCapabilities()?.experimental).toBeUndefined();
    } finally {
      await client.close();
      await noesis.cleanup();
    }
  });
});
