import { apiPath, type apiRoutes } from '@repo/local-contracts';
import type { McpConfig } from './config.js';

/** Thin REST client for the server app's `/api` surface. */
export class ServerClient {
  constructor(private readonly config: McpConfig) {}

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
