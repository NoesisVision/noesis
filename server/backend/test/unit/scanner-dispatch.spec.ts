import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { mkdir, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { SystemModelSchema } from '@repo/shared-contracts';
import { languageScanners } from '../../src/scanner/languages/index.js';
import { ScannerService } from '../../src/scanner/scanner.service.js';
import { type TestNoesis, testNoesis } from './test-noesis.js';

/*
 * The service over every language scanner, on a repository that mixes
 * TypeScript and Java: which scanner handles a directory follows from the
 * unit markers it finds, nothing is configured.
 */

let t: TestNoesis;
let scanner: ScannerService;

beforeEach(async () => {
  t = await testNoesis();
  scanner = new ScannerService(t.root, t.systemModelRepository, {
    now: () => '2026-09-15T12:00:00.000Z',
  });
});

afterEach(() => t.cleanup());

async function files(entries: Record<string, string>): Promise<void> {
  for (const [path, content] of Object.entries(entries)) {
    await mkdir(join(t.root, path, '..'), { recursive: true });
    await writeFile(join(t.root, path), content);
  }
}

const pom = (artifactId: string) =>
  `<project><artifactId>${artifactId}</artifactId></project>\n`;
const pkg = (name: string) => JSON.stringify({ name });

async function models() {
  const stored = await t.systemModelRepository.list();
  return stored.map((s) => SystemModelSchema.parse(s.entity));
}

describe('ScannerService over every language', () => {
  it('registers the TypeScript and Java scanners by default', () => {
    expect(languageScanners.map((s) => s.name)).toEqual([
      'noesis-typescript',
      'noesis-java',
    ]);
  });

  it('scans a TypeScript frontend and a Java backend side by side, each with its own scanner', async () => {
    await files({
      'web/package.json': pkg('@acme/web'),
      'web/src/booking/booking.service.ts':
        'export class BookingService {\n  book(): void {}\n}\n',
      'api/pom.xml': pom('acme-api'),
      'api/src/main/java/com/acme/api/booking/Booking.java': `package com.acme.api.booking;
@AggregateRoot
public class Booking { public void confirm() {} }
`,
    });

    const report = await scanner.scan();

    expect(
      report.units.map((u) => [u.scanner, u.name, u.buildingBlocks]),
    ).toEqual([
      ['noesis-typescript', '@acme/web', 1],
      ['noesis-java', 'acme-api', 1],
    ]);
    const [web, api] = await models();
    expect(web?.scanner.name).toBe('noesis-typescript');
    expect(web?.buildingBlocks.map((b) => [b.name, b.type])).toEqual([
      ['BookingService', 'application_service'],
    ]);
    expect(api?.scanner.name).toBe('noesis-java');
    expect(api?.buildingBlocks.map((b) => [b.name, b.type])).toEqual([
      ['Booking', 'aggregate'],
    ]);
  });

  it('keeps a Maven module and an npm package of the same name as two files', async () => {
    await files({
      'ts/core/package.json': pkg('core'),
      'ts/core/src/a.ts': 'export class A {}\n',
      'jvm/core/pom.xml': pom('core'),
      'jvm/core/src/main/java/com/acme/A.java':
        'package com.acme; public class A {}\n',
    });

    const report = await scanner.scan();

    expect(report.units.map((u) => [u.scanner, u.name])).toEqual([
      ['noesis-typescript', 'core'],
      ['noesis-java', 'core'],
    ]);
    const stored = await t.systemModelRepository.list();
    expect(stored).toHaveLength(2);
    expect(new Set(stored.map((s) => s.entity.id)).size).toBe(2);
    expect(stored.map((s) => s.entity.scanner.name).sort()).toEqual([
      'noesis-java',
      'noesis-typescript',
    ]);
  });

  it('lets each scanner ignore the other language: a Java tree under an npm package, an npm tree under a Maven module', async () => {
    await files({
      'package.json': pkg('monorepo'),
      'src/index.ts': 'export class Root {}\n',
      'src/legacy/Thing.java': 'package legacy; public class Thing {}\n',
      'service/pom.xml': pom('service'),
      'service/src/main/java/com/acme/S.java':
        'package com.acme; public class S {}\n',
      'service/src/main/resources/static/package.json': pkg('static-assets'),
      'service/src/main/resources/static/app.ts': 'export class App {}\n',
    });

    const report = await scanner.scan();

    expect(
      report.units.map((u) => [u.scanner, u.name, u.buildingBlocks]),
    ).toEqual([
      ['noesis-typescript', 'monorepo', 1],
      ['noesis-typescript', 'static-assets', 1],
      ['noesis-java', 'service', 1],
    ]);
    const byName = new Map((await models()).map((m) => [m.name, m]));
    // A stray .java file under an npm package is nobody's unit.
    expect(byName.get('monorepo')?.buildingBlocks.map((b) => b.name)).toEqual([
      'Root',
    ]);
    // The Java scanner does not descend into the nested npm package's .ts,
    // and the TypeScript scanner does not read the Maven module's .java.
    expect(byName.get('service')?.buildingBlocks.map((b) => b.name)).toEqual([
      'S',
    ]);
  });

  it('reports nothing for a unit of one language with no sources, and drops the file of a unit that vanished whichever language wrote it', async () => {
    await files({
      'docs/package.json': pkg('docs'),
      'docs/README.md': 'no sources',
      'web/package.json': pkg('web'),
      'web/src/a.ts': 'export class A {}\n',
      'api/pom.xml': pom('api'),
      'api/src/main/java/com/acme/A.java': 'package com.acme; class A {}\n',
    });

    const first = await scanner.scan();
    expect(first.units.map((u) => u.name)).toEqual(['web', 'api']);
    expect(first.removed).toEqual([]);

    await rm(join(t.root, 'api'), { recursive: true });
    const second = await scanner.scan();

    expect(second.units.map((u) => u.name)).toEqual(['web']);
    expect(second.removed).toEqual(['api']);
    expect((await models()).map((m) => m.name)).toEqual(['web']);
  });

  it('finds no units in a repository of neither language', async () => {
    await files({ 'main.py': 'class Nope: pass\n', 'go.mod': 'module x\n' });
    const report = await scanner.scan();
    expect(report.units).toEqual([]);
    expect(await models()).toEqual([]);
  });
});
