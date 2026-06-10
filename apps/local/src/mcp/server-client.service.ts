import { Inject, Injectable } from '@nestjs/common';
import { apiPath, type apiRoutes } from '@repo/local-contracts';
import type { McpConfig } from './config';

export const MCP_CONFIG = 'MCP_CONFIG';

/** Thin REST client for the server app's `/api` surface. */
@Injectable()
export class ServerClientService {
  constructor(@Inject(MCP_CONFIG) private readonly config: McpConfig) {}

  get serverUrl(): string {
    return this.config.serverUrl;
  }

  async hello(): Promise<string> {
    const res = await fetch(this.url('hello'));
    if (!res.ok) {
      throw new Error(`Server responded ${res.status} ${res.statusText}`);
    }
    return res.text();
  }

  private url(route: Exclude<keyof typeof apiRoutes, 'prefix'>): string {
    return `${this.config.serverUrl.replace(/\/$/, '')}/${apiPath(route)}`;
  }
}
