import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { createUiApp } from '#backend/adapters/in/ui/ui.routes';
import type { SystemModel } from '#backend/app/system-model/system-model';
import { type TestNoesis, testNoesis } from './test-noesis';

let t: TestNoesis;
let app: ReturnType<typeof createUiApp>;

beforeEach(async () => {
  t = await testNoesis();
  app = createUiApp(t);
});

afterEach(() => t.cleanup());

describe('ui system models routes', () => {
  it('answers null before the first scan', async () => {
    const response = await app.request('/system-models/newest');
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ systemModel: null });
  });

  it('scans and answers the model it stored as the newest', async () => {
    const response = await app.request('/system-models', { method: 'POST' });
    expect(response.status).toBe(201);
    const { systemModel } = (await response.json()) as {
      systemModel: SystemModel;
    };

    const newest = await app.request('/system-models/newest');
    expect(await newest.json()).toEqual({ systemModel });
  });
});
