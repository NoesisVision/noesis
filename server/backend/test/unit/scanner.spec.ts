import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { SystemModelSchema } from '@repo/shared-contracts';
import { dataFileOf } from '../../src/infra/files/noesis-store.js';
import { ScannerService } from '../../src/scanner/scanner.service.js';
import {
  exportedClasses,
  findUnits,
  typeOf,
} from '../../src/scanner/typescript-scanner.js';
import { all, type TestNoesis, testNoesis } from './test-noesis.js';

let t: TestNoesis;
let scanner: ScannerService;

beforeEach(async () => {
  t = await testNoesis();
  scanner = new ScannerService(
    t.root,
    t.systemModels,
    () => '2026-09-12T12:00:00.000Z',
  );
});

afterEach(() => t.cleanup());

/** The stored files by id, with their bytes: what a scan leaves on disk. */
async function filesOf(store: TestNoesis['systemModels']) {
  const ids = (await Array.fromAsync(store.keys())).sort();
  return Promise.all(
    ids.map(async (id) => [id, await readFile(dataFileOf(store, id), 'utf8')]),
  );
}

/** Lays out a package with source files, given as path → content under its dir. */
async function pkg(
  dir: string,
  name: string,
  files: Record<string, string>,
): Promise<void> {
  await mkdir(join(t.root, dir), { recursive: true });
  await writeFile(
    join(t.root, dir, 'package.json'),
    JSON.stringify({ name }, null, 2),
  );
  for (const [path, content] of Object.entries(files)) {
    await mkdir(join(t.root, dir, path, '..'), { recursive: true });
    await writeFile(join(t.root, dir, path), content);
  }
}

const bookingService = `import { x } from './x.js';

/** Books appointments. */
export class BookingService implements Booker {
  private readonly repo: SlotRepository;

  constructor(repo: SlotRepository) {
    this.repo = repo;
  }

  async book(slot: string): Promise<void> {
    await this.repo.hold(slot);
  }

  static create(): BookingService {
    return new BookingService(new SlotRepository());
  }

  private check(): void {}
}

export class SlotRepository {
  hold(slot: string): void {}
}

class Hidden {
  visible(): void {}
}
`;

describe('exportedClasses', () => {
  it('finds exported classes, their public methods and implements clauses, with line numbers', () => {
    const found = exportedClasses(bookingService.split('\n'));
    expect(found.map((c) => c.name)).toEqual([
      'BookingService',
      'SlotRepository',
    ]);
    const [service, repository] = found;
    expect(service?.line).toBe(4);
    expect(service?.implements).toEqual(['Booker']);
    expect(service?.methods).toEqual([
      { name: 'book', line: 11 },
      { name: 'create', line: 15 },
    ]);
    expect(repository?.methods).toEqual([{ name: 'hold', line: 23 }]);
  });
});

describe('typeOf', () => {
  it('types blocks by their conventional name suffix', () => {
    expect(typeOf('SlotRepository')).toBe('repository');
    expect(typeOf('BookingService')).toBe('application_service');
    expect(typeOf('PaymentGateway')).toBe('external_integration');
    expect(typeOf('AppointmentBooked')).toBeNull();
  });
});

describe('ScannerService', () => {
  it('writes one system-model file per unit with the code as bounded context, module, blocks and behaviours', async () => {
    await pkg('server/backend', '@acme/backend', {
      'src/booking/booking.service.ts': bookingService,
      'src/booking/booking.service.spec.ts': 'export class NotScanned {}\n',
      'src/index.ts': 'export class Root {\n  run(): void {}\n}\n',
      'node_modules/dep/index.ts': 'export class Dep {}\n',
    });
    await pkg('packages/empty', '@acme/empty', { 'README.md': 'no sources' });

    const report = await scanner.scan();

    expect(report.units.map((u) => [u.name, u.buildingBlocks])).toEqual([
      ['@acme/backend', 3],
    ]);
    const [stored] = await all(t.systemModels);
    const model = SystemModelSchema.parse(stored);
    expect(model.name).toBe('@acme/backend');
    expect(model.scanned_at).toBe('2026-09-12T12:00:00.000Z');
    expect(model.boundedContexts).toEqual([
      {
        id: 'bc:@acme/backend',
        name: '@acme/backend',
        description: '',
        source: { path: 'server/backend', line: null },
      },
    ]);
    expect(model.domainModules).toEqual([
      {
        id: 'mod:@acme/backend/booking',
        name: 'booking',
        boundedContextId: 'bc:@acme/backend',
        description: '',
        source: { path: 'server/backend/src/booking', line: null },
      },
    ]);
    const service = model.buildingBlocks.find(
      (b) => b.name === 'BookingService',
    );
    expect(service).toMatchObject({
      id: 'bb:server/backend/src/booking/booking.service.ts#BookingService',
      type: 'application_service',
      domainModuleId: 'mod:@acme/backend/booking',
      // `Booker` is an interface outside the model, so it does not resolve.
      implements: [],
      source: {
        path: 'server/backend/src/booking/booking.service.ts',
        line: 4,
      },
    });
    const root = model.buildingBlocks.find((b) => b.name === 'Root');
    expect(root?.domainModuleId).toBeNull();
    expect(model.behaviours.map((b) => b.name).sort()).toEqual([
      'book',
      'create',
      'hold',
      'run',
    ]);
    expect(
      model.behaviours.find((b) => b.name === 'book')?.buildingBlockId,
    ).toBe(service?.id ?? 'missing');
  });

  it('is stable across scans and drops the file of a unit that vanished', async () => {
    await pkg('a', 'a', { 'src/a.ts': 'export class A {}\n' });
    await pkg('b', 'b', { 'src/b.ts': 'export class B {}\n' });
    const first = await scanner.scan();
    const before = await filesOf(t.systemModels);
    expect(first.units).toHaveLength(2);

    await rm(join(t.root, 'b'), { recursive: true });
    const second = await scanner.scan();

    expect(second.removed).toEqual(['b']);
    const after = await filesOf(t.systemModels);
    expect(after).toEqual(before.filter(([id]) => id === after[0]?.[0]));
    expect(after).toHaveLength(1);
  });

  it('treats nested packages as their own units', async () => {
    await pkg('.', 'root', { 'src/root.ts': 'export class R {}\n' });
    await pkg('packages/inner', 'inner', {
      'src/inner.ts': 'export class I {}\n',
    });

    const units = await findUnits(t.root);
    expect(units.map((u) => u.name)).toEqual(['root', 'inner']);

    const report = await scanner.scan();
    expect(report.units.map((u) => [u.name, u.buildingBlocks])).toEqual([
      ['root', 1],
      ['inner', 1],
    ]);
  });
});
