// The C# scanner end to end: the real `noesis-scan-csharp` (built from
// scanners/dotnet) over examples/discounts-dotnet, then the projection. Needs
// the .NET SDK. Besides the model, the test measures both stages against a
// budget, so a performance regression in either fails here and the timings
// are printed for the record.
import { beforeAll, describe, expect, it } from 'bun:test';
import { readdir } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { CSharpSourceCodeScanner } from '#backend/adapters/out/scanners/csharp/csharp.scanner';
import { loadNoesisConfig } from '#backend/adapters/out/scanners/noesis-config';
import {
  CodeModelFile,
  ScanManifest,
} from '#backend/app/code-model/code-model';
import { CSHARP_VOCABULARY } from '#backend/app/code-model/projection/csharp.vocabulary';
import { projectSystemModel } from '#backend/app/code-model/projection/project-system-model';
import { SystemModel } from '#backend/app/system-model/system-model';
import { NoesisDir } from '#backend/platform/files/noesis-dir';

const REPOSITORY = resolve(import.meta.dir, '../../../..');
const EXAMPLE = join(REPOSITORY, 'examples', 'discounts-dotnet');
const CLI_PROJECT = join(
  REPOSITORY,
  'scanners',
  'dotnet',
  'src',
  'Noesis.Scanner.Cli',
);

/** Generous: the first stage restores packages and loads MSBuild; a cold run takes ~20 s here. */
const FIRST_STAGE_BUDGET_MS = 180_000;
/** The projection is in-memory over a few thousand nodes; it takes ~10 ms here. */
const PROJECTION_BUDGET_MS = 2_000;

let command: string[];

async function run(cmd: string[], cwd: string): Promise<string> {
  const process = Bun.spawn(cmd, { cwd, stdout: 'pipe', stderr: 'pipe' });
  const [out, err, code] = await Promise.all([
    new Response(process.stdout).text(),
    new Response(process.stderr).text(),
    process.exited,
  ]);
  if (code !== 0)
    throw new Error(`${cmd.join(' ')} failed (${code}):\n${out}${err}`);
  return out;
}

beforeAll(async () => {
  await run(
    [
      'dotnet',
      'build',
      CLI_PROJECT,
      '-c',
      'Release',
      '-v',
      'quiet',
      '--nologo',
    ],
    REPOSITORY,
  );
  const binaries = join(CLI_PROJECT, 'bin', 'Release');
  const [framework] = await readdir(binaries);
  if (framework === undefined)
    throw new Error(`nothing built under ${binaries}`);
  command = ['dotnet', join(binaries, framework, 'noesis-scan-csharp.dll')];
}, FIRST_STAGE_BUDGET_MS);

describe('examples/discounts-dotnet through the C# scanner (e2e)', () => {
  it(
    'scans the solution with noesis-scan-csharp and projects the system model within budget',
    async () => {
      const noesis = new NoesisDir(EXAMPLE);
      const scanner = new CSharpSourceCodeScanner({
        noesis,
        now: () => new Date().toISOString(),
        command,
      });

      const started = performance.now();
      const model = SystemModel.parse(await scanner.scan());
      const bothStages = performance.now() - started;

      // The projection alone, over what the first stage just wrote.
      const outDir = noesis.resolve('sessions', 'scanner');
      const manifest = ScanManifest.parse(
        await Bun.file(
          join(outDir, 'code-model', 'csharp', 'manifest.json'),
        ).json(),
      );
      const files = await Promise.all(
        manifest.artifacts.map(async ({ file }) =>
          CodeModelFile.parse(await Bun.file(join(outDir, file)).json()),
        ),
      );
      const { namespaces: config } = await loadNoesisConfig(EXAMPLE);
      const projectionStart = performance.now();
      const { model: projected } = projectSystemModel({
        manifest,
        files,
        vocabulary: CSHARP_VOCABULARY,
        config,
      });
      const projection = performance.now() - projectionStart;

      console.log(
        `[e2e] discounts-dotnet: both stages ${Math.round(bothStages)} ms, projection alone ${projection.toFixed(1)} ms, ${files.length} artifacts, ${model.buildingBlocks.length} blocks, ${model.behaviours.length} behaviours`,
      );
      expect<unknown>(bothStages).toBeLessThan(FIRST_STAGE_BUDGET_MS);
      expect<unknown>(projection).toBeLessThan(PROJECTION_BUDGET_MS);
      expect<unknown>(projected.buildingBlocks).toEqual(model.buildingBlocks);

      // What the as-built design of the example names, by the rules.
      expect<unknown>(model.name).toBe('discounts-dotnet');
      expect<unknown>(manifest.artifacts.map((a) => a.id)).toContain(
        'A:MyCompany.ECommerce.Sales.DeepModel',
      );
      expect<unknown>(model.modules.map((m) => m.id)).toEqual(
        expect.arrayContaining([
          'module|Sales',
          'module|Sales.Orders',
          'module|Sales.Pricing',
        ]),
      );
      // MyCompany.ECommerce is skipped, *.TechnicalStuff.* excluded.
      expect<unknown>(
        model.modules.some((m) => (m.id as string).includes('TechnicalStuff')),
      ).toBe(false);
      expect<unknown>(
        model.modules.some((m) => (m.id as string).includes('MyCompany')),
      ).toBe(false);

      const block = (id: string) =>
        model.buildingBlocks.find((b) => b.id === id);
      expect<unknown>(block('building_block|Sales.Orders.Order')).toMatchObject(
        {
          type: 'aggregate',
          description: expect.stringContaining(
            'An order is a request for products.',
          ),
          source: {
            path: 'Sources/Sales/Sales.DeepModel/Orders/Order.Data.cs',
          },
        },
      );
      expect<unknown>(
        block('building_block|Sales.Orders.Order Repository')?.type,
      ).toBe('repository');
      expect<unknown>(
        block('building_block|Sales.Orders.Order Factory')?.type,
      ).toBe('factory');
      expect<unknown>(
        block('building_block|Sales.Orders.Order Placed')?.type,
      ).toBe('value_object');
      expect<unknown>(
        block('building_block|Sales.Orders.AllOrderDetails')?.type,
      ).toBe('value_object');
      expect<unknown>(
        block('building_block|Sales.ExchangeRates.ExchangeRateProvider')?.type,
      ).toBe('external_integration');
      expect<unknown>(
        block('building_block|Sales.Pricing.Discounts.ClientLevelDiscounts')
          ?.implements,
      ).toEqual([
        'building_block|Sales.Pricing.OfferModifier',
        'building_block|Sales.Pricing.QuoteModifier',
      ]);

      const behaviour = (id: string) =>
        model.behaviours.find((b) => b.id === id);
      expect<unknown>(
        behaviour('behavior|Sales.Orders.Order.ConfirmPrices'),
      ).toMatchObject({
        type: 'Command',
        visibility: { kind: 'public', actors: [] },
        input: [
          { name: 'offer', type: 'building_block|Sales.Pricing.Offer' },
          {
            name: 'priceChangesPolicy',
            type: 'building_block|Sales.Orders.PriceChanges.PriceChangesPolicy',
          },
          { name: 'agreementExpiresOn', type: 'primitive|datetime' },
        ],
        invokes: expect.arrayContaining([
          'behavior|Sales.Orders.PriceChanges.PriceChangesPolicy.CanChangePrices',
        ]),
      });
      expect<unknown>(
        behaviour('behavior|Sales.Orders.Order Repository.GetBy')?.output,
      ).toEqual([
        {
          type: 'building_block|Sales.Orders.Order',
          description: null,
          optional: false,
        },
      ]);
      expect<unknown>(
        behaviour('behavior|Sales.Pricing.CalculatePrices.For')?.invokes,
      ).toEqual(
        expect.arrayContaining([
          'behavior|Sales.ExchangeRates.ExchangeRateProvider.GetFor',
          'behavior|Sales.Pricing.OfferModifiers.ChooseFor',
          'behavior|Sales.Pricing.PriceLists.PriceListRepository.GetBasePricesFor',
        ]),
      );
      expect<unknown>(model.behaviours.map((b) => b.name)).not.toContain(
        'ToString',
      );
      expect<unknown>(model.behaviours.map((b) => b.name)).not.toContain(
        'Equals',
      );
    },
    FIRST_STAGE_BUDGET_MS + PROJECTION_BUDGET_MS,
  );
});
