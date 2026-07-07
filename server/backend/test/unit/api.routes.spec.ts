import { describe, expect, it } from 'bun:test';
import { apiRoutes } from '@repo/local-contracts';
import { createApiApp } from '../../src/api/api.routes.js';
import { GreetingService } from '../../src/greeting/greeting.service.js';

describe('api routes', () => {
  const app = createApiApp({ greetingService: new GreetingService() });

  it('returns the greeting on the contract path', async () => {
    const res = await app.request(`/${apiRoutes.hello}`);
    expect(res.status).toBe(200);
    expect(await res.text()).toBe('Hello World!');
  });
});
