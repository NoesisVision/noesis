import { describe, expect, it } from 'bun:test';
import { GreetingService } from '../../src/greeting/greeting.service.js';
import { createUiApp } from '../../src/ui/ui.routes.js';

describe('ui routes', () => {
  const app = createUiApp({ greetingService: new GreetingService() });

  it('returns the greeting', async () => {
    const res = await app.request('/hello');
    expect(res.status).toBe(200);
    expect(await res.text()).toBe('Hello World!');
  });
});
