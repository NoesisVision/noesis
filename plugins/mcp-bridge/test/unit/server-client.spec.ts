import { afterAll, describe, expect, it } from 'bun:test';
import { apiPath } from '@repo/local-contracts';
import { ServerClient } from '../../src/server-client.js';

// Ephemeral stand-in for the server app's /api surface.
const okServer = Bun.serve({
  port: 0,
  fetch(req) {
    const url = new URL(req.url);
    if (url.pathname === `/${apiPath('hello')}`) {
      return new Response('Hello World!');
    }
    return new Response('not found', { status: 404 });
  },
});
const brokenServer = Bun.serve({
  port: 0,
  fetch: () => new Response('boom', { status: 500 }),
});

afterAll(async () => {
  await okServer.stop();
  await brokenServer.stop();
});

describe('ServerClient', () => {
  it('fetches the greeting from the /api surface (trailing slash in the URL tolerated)', async () => {
    // `${server.url}` carries a trailing slash — exercises the normalization.
    const client = new ServerClient({ serverUrl: `${okServer.url}` });
    expect(await client.hello()).toBe('Hello World!');
  });

  it('throws with status details on a non-ok response', async () => {
    const client = new ServerClient({ serverUrl: `${brokenServer.url}` });
    expect(client.hello()).rejects.toThrow('Server responded 500');
  });
});
