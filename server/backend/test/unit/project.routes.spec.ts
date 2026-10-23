import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { basename } from 'node:path';
import { createUiApp } from '#backend/adapters/in/ui/ui.routes';
import { type TestNoesis, testNoesis } from './test-noesis';

let t: TestNoesis;
let app: ReturnType<typeof createUiApp>;

beforeEach(async () => {
  t = await testNoesis();
  app = createUiApp(t);
});

afterEach(() => t.cleanup());

describe('ui project route', () => {
  it('names the project by its folder, before anything is scanned', async () => {
    const response = await app.request('/project');
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      project: { name: basename(t.root) },
    });
  });
});
