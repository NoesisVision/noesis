import { afterAll, beforeAll, describe, it } from 'bun:test';
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { apiPath } from '@repo/local-contracts';
import { uiPath } from '@repo/ui-contracts';
import { AppModule } from '../src/app.module';

// One shared app for all route assertions: AppModule now boots LadybugDB, and
// lbug segfaults with many DB instances per process, so we avoid a per-test app.
// The in-memory DB keeps the run off disk.
describe('Route surfaces (e2e)', () => {
  let app: INestApplication<App>;

  beforeAll(async () => {
    process.env.NOESIS_DATA_DIR = ':memory:';
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  it(`/${uiPath('hello')} (GET) — ui surface`, () => {
    return request(app.getHttpServer())
      .get(`/${uiPath('hello')}`)
      .expect(200)
      .expect('Hello World!');
  });

  it(`/${apiPath('hello')} (GET) — api surface`, () => {
    return request(app.getHttpServer())
      .get(`/${apiPath('hello')}`)
      .expect(200)
      .expect('Hello World!');
  });

  it('/internal/health (GET) — internal surface', () => {
    return request(app.getHttpServer())
      .get('/internal/health')
      .expect(200)
      .expect({ status: 'ok' });
  });

  it('/ (GET) — no route at the root', () => {
    return request(app.getHttpServer()).get('/').expect(404);
  });

  afterAll(async () => {
    await app.close();
  });
});
