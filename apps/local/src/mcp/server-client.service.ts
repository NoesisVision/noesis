import { Inject, Injectable } from '@nestjs/common';
import type { McpConfig } from './config';

export const MCP_CONFIG = 'MCP_CONFIG';

/** Thin REST client for the server app. */
@Injectable()
export class ServerClientService {
  constructor(@Inject(MCP_CONFIG) private readonly config: McpConfig) {}

  get serverUrl(): string {
    return this.config.serverUrl;
  }

  async hello(): Promise<string> {
    const res = await fetch(this.config.serverUrl);
    if (!res.ok) {
      throw new Error(`Server responded ${res.status} ${res.statusText}`);
    }
    return res.text();
  }
}
