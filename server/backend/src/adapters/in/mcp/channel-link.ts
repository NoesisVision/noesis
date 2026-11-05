import type { McpServer } from '@modelcontextprotocol/server';

/** What a channel message says beyond its text, each key an attribute the model sees. */
export type ChannelMeta = Record<string, string>;

/**
 * The connection the host opened to this process, kept so the page can
 * speak into the session that started the service: Claude Code's channel
 * notifications, which an interactive session loaded with the channel
 * reads as a message from the page. Only the serving connection is kept;
 * the era probe is never attached.
 */
export class ChannelLink {
  private server: McpServer | null = null;

  attach(server: McpServer): void {
    this.server = server;
  }

  /** False when no host is connected yet: the message went nowhere. */
  async notify(content: string, meta: ChannelMeta): Promise<boolean> {
    if (this.server === null) return false;
    await this.server.server.notification({
      method: 'notifications/claude/channel',
      params: { content, meta },
    });
    return true;
  }
}
