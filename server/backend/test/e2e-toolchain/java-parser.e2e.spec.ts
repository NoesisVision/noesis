// The Java parser end to end: the shop fixture declares the `noesis:parse`
// Maven plugin (built and installed from code-parsers/java), and its
// .noesis/settings.json runs it through the java parser, then the system
// model builder. Needs a JDK and Maven. The model must equal the one built of the
// committed code model, which keeps the fixture's committed files honest.
// The billing fixture depends on test/fixtures/java/shared-kernel, a library
// built and installed here and never parsed: its library manifest makes the
// stubs of a value object and a domain service blocks of the model (R14).
import { beforeAll, describe, expect, it } from 'bun:test';
import { join, resolve } from 'node:path';
import { GitSourceRepository } from '#backend/adapters/out/scanners/git-source-repository';
import { ScannerSettingsFileRepository } from '#backend/adapters/out/store/scanner-settings.repository';
import { systemClock } from '#backend/app/clock';
import {
  CodeModelFile,
  ParseManifest,
} from '#backend/app/scanners/code-parsers/code-model';
import type {
  CodeParser,
  ParsedCode,
} from '#backend/app/scanners/code-parsers/code-parser';
import { buildSystemModel } from '#backend/app/scanners/system-model-builders/build-system-model';
import { JAVA_VOCABULARY } from '#backend/app/scanners/system-model-builders/java.vocabulary';
import { SystemModel } from '#backend/app/system-model/system-model';
import { codeParserFor } from '#backend/boot/code-parsers';
import { NoesisDir } from '#backend/platform/files/noesis-dir';
import { scannerOver } from '../support/test-scanner';

const REPOSITORY = resolve(import.meta.dir, '../../../..');
const PARSER = join(REPOSITORY, 'code-parsers', 'java');
const FIXTURE = join(import.meta.dir, '..', 'fixtures', 'java', 'shop');
const LIBRARY = join(
  import.meta.dir,
  '..',
  'fixtures',
  'java',
  'shared-kernel',
);
const BILLING = join(import.meta.dir, '..', 'fixtures', 'java', 'billing');

/** Generous: a cold `mvn install` downloads plugins and a cold scan compiles the fixture; ~1 min here. */
const INSTALL_BUDGET_MS = 300_000;
const SCAN_BUDGET_MS = 180_000;

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
      'mvn',
      '-B',
      '-q',
      '-ntp',
      'install',
      '-DskipTests',
      '-Dinvoker.skip=true',
    ],
    PARSER,
  );
  // The library billing depends on, as a team would publish it.
  await run(['mvn', '-B', '-q', '-ntp', 'install'], LIBRARY);
}, INSTALL_BUDGET_MS);

/** `parser`, keeping the code model it read for the spec to look into. */
function recording(parser: CodeParser): CodeParser & { parsed?: ParsedCode } {
  const recorder: CodeParser & { parsed?: ParsedCode } = {
    parse: async () => (recorder.parsed = await parser.parse()),
  };
  return recorder;
}

describe('test/fixtures/java/shop through the Java parser (e2e)', () => {
  it(
    'scans the build with its own settings and builds the system model within budget',
    async () => {
      const noesis = new NoesisDir(FIXTURE);
      const settings = await new ScannerSettingsFileRepository(
        noesis,
      ).repositorySettings();
      const config = settings.namespaces;
      const scanner = scannerOver(
        noesis,
        codeParserFor(noesis)(settings.parser),
        config,
        systemClock,
        settings.libraries,
      );

      const started = performance.now();
      const model = SystemModel.parse(await scanner.scan());
      const bothStages = performance.now() - started;

      // The system model built of the committed code model: what the unit tests run on.
      const manifest = ParseManifest.parse(
        await Bun.file(
          join(FIXTURE, 'code-model', 'java', 'manifest.json'),
        ).json(),
      );
      const files = await Promise.all(
        manifest.artifacts.map(async ({ file }) =>
          CodeModelFile.parse(await Bun.file(join(FIXTURE, file)).json()),
        ),
      );
      const { model: committed, diagnostics } = buildSystemModel({
        manifest,
        files,
        featureFiles: await new GitSourceRepository(FIXTURE).featureFiles(),
        vocabulary: JAVA_VOCABULARY,
        config,
        libraries: settings.libraries,
      });

      console.log(
        `[e2e] java shop: both stages ${Math.round(bothStages)} ms, ${files.length} artifacts, ${model.buildingBlocks.length} blocks, ${model.behaviors.length} behaviors`,
      );
      expect<unknown>(bothStages).toBeLessThan(SCAN_BUDGET_MS);
      expect<unknown>(model.name).toBe('shop');
      expect<unknown>(model.modules).toEqual(committed.modules);
      expect<unknown>(model.buildingBlocks).toEqual(committed.buildingBlocks);
      expect<unknown>(model.behaviors).toEqual(committed.behaviors);
      expect<unknown>(model.rules).toEqual(committed.rules);
      expect<unknown>(model.scenarios).toEqual(committed.scenarios);
      expect<unknown>(model.rules.map((r) => r.name)).toEqual([
        'Order total',
        'Placing an order',
      ]);
      expect<unknown>(model.deployableUnits).toEqual(committed.deployableUnits);
      expect<unknown>(model.libraries).toEqual(committed.libraries);
      expect<unknown>(model.layers).toEqual(committed.layers);
      expect<unknown>(model.relations).toEqual(committed.relations);
      // `@Layer` on package-info.java reaches the model through the real
      // parser: com.acme.shop's names the domain layer, which holds every
      // block below it; the infrastructure package's holds none (R15).
      expect<unknown>(model.layers).toEqual([
        {
          id: 'layer|domain',
          name: 'domain',
          description: null,
          source: {
            path: 'shop-domain/src/main/java/com/acme/shop/package-info.java',
            line: 3,
          },
        },
      ]);
      expect<unknown>(model.relations).toContainEqual({
        kind: 'contains',
        from: 'layer|domain',
        to: 'building_block|shop.orders.Order',
      });
      expect<unknown>(diagnostics.map((d) => d.message)).toContain(
        'layer|infrastructure holds no building block; dropped',
      );
      // The money API is a real dependency the build resolves and no scan
      // parses; its manifest makes the stubbed currency a block (R14).
      expect<unknown>(model.relations).toContainEqual({
        kind: 'has_state',
        from: 'building_block|shop.orders.Order',
        to: 'building_block|javax.money.Currency',
        name: 'currency',
        cardinality: '1',
      });
      expect<unknown>(
        model.buildingBlocks.find(
          (b) => b.id === 'building_block|shop.orders.PlaceOrder',
        )?.type,
      ).toBe('command');
    },
    SCAN_BUDGET_MS,
  );
});

describe('test/fixtures/java/billing over a library no scan parses (e2e)', () => {
  const MONEY = 'building_block|kernel.Money';
  const EXCHANGE_RATES = 'building_block|kernel.Exchange rates';
  const MANIFEST = '.noesis/libraries/shared-kernel.json';

  it(
    "reaches the library's types as stubs and makes the ones its manifest lists blocks",
    async () => {
      const noesis = new NoesisDir(BILLING);
      const settings = await new ScannerSettingsFileRepository(
        noesis,
      ).repositorySettings();
      expect<unknown>(settings.libraries).toEqual([
        {
          path: MANIFEST,
          name: 'shared-kernel',
          description:
            "The kernel the company's systems share: a library the scan never parses.",
          buildingBlocks: [
            {
              type: 'com.acme.kernel.Money',
              kind: 'value_object',
              description: 'An amount in a currency.',
            },
            {
              type: 'com.acme.kernel.ExchangeRates',
              kind: 'domain_service',
              name: 'Exchange rates',
              description:
                'Converts money between currencies; each system brings its own rates.',
            },
          ],
        },
      ]);
      const parser = recording(codeParserFor(noesis)(settings.parser));
      const model = SystemModel.parse(
        await scannerOver(
          noesis,
          parser,
          settings.namespaces,
          systemClock,
          settings.libraries,
        ).scan(),
      );

      // The code model: billing alone is parsed; the library is a dependency
      // whose types the code reaches only as stubs.
      const files = parser.parsed?.files ?? [];
      expect<unknown>(files.map((f) => f.artifact.id)).toEqual(['A:billing']);
      const [billing] = files;
      const library = 'A:com.acme:shared-kernel@1.0';
      expect<unknown>(billing?.artifact.dependencies).toContainEqual({
        id: library,
        kind: 'library',
        package: { id: 'com.acme:shared-kernel', version: '1.0' },
      });
      expect<unknown>(
        billing?.nodes.filter((n) => n.id.startsWith('T:com.acme.kernel.')),
      ).toEqual([]);
      expect<unknown>(billing?.stubs).toContainEqual({
        id: 'T:com.acme.kernel.Money',
        kind: 'type',
        name: 'Money',
        typeKind: 'class',
        artifact: library,
      });
      expect<unknown>(billing?.stubs).toContainEqual({
        id: 'T:com.acme.kernel.ExchangeRates',
        kind: 'type',
        name: 'ExchangeRates',
        typeKind: 'interface',
        artifact: library,
      });
      expect<unknown>(billing?.edges).toContainEqual({
        kind: 'IMPLEMENTS',
        from: 'T:com.acme.billing.rates.FixedExchangeRates',
        to: {
          kind: 'named',
          type: 'T:com.acme.kernel.ExchangeRates',
          typeArguments: [],
          unbound: false,
          nullable: false,
        },
      });

      // The system model: the manifest is a library of the two blocks it
      // lists, in the module their package maps to, at the manifest.
      const atManifest = { path: MANIFEST, line: null };
      expect<unknown>(model.libraries).toContainEqual({
        id: 'library|shared-kernel',
        name: 'shared-kernel',
        description:
          "The kernel the company's systems share: a library the scan never parses.",
        source: atManifest,
      });
      expect<unknown>(
        model.buildingBlocks.filter((b) =>
          b.id.startsWith('building_block|kernel.'),
        ),
      ).toEqual([
        {
          id: EXCHANGE_RATES,
          name: 'Exchange rates',
          type: 'domain_service',
          description:
            'Converts money between currencies; each system brings its own rates.',
          source: atManifest,
        },
        {
          id: MONEY,
          name: 'Money',
          type: 'value_object',
          description: 'An amount in a currency.',
          source: atManifest,
        },
      ]);
      expect<unknown>(
        model.modules.find((m) => m.id === 'module|kernel'),
      ).toEqual({
        id: 'module|kernel',
        name: 'kernel',
        description: null,
        source: atManifest,
      });
      // Every use of the library's types in billing points at its blocks:
      // the implementation extends the interface, a service holds it as a
      // collaborator, the aggregate holds the value as state, and behaviors
      // take and give both.
      const listed = new Set<string>([MONEY, EXCHANGE_RATES]);
      expect<unknown>(
        model.relations.filter((r) => listed.has(r.from) || listed.has(r.to)),
      ).toEqual([
        { kind: 'contains', from: 'library|shared-kernel', to: EXCHANGE_RATES },
        { kind: 'contains', from: 'library|shared-kernel', to: MONEY },
        { kind: 'contains', from: 'module|kernel', to: EXCHANGE_RATES },
        { kind: 'contains', from: 'module|kernel', to: MONEY },
        {
          kind: 'extends',
          from: 'building_block|billing.rates.FixedExchangeRates',
          to: EXCHANGE_RATES,
        },
        {
          kind: 'has_collaborator',
          from: 'building_block|billing.invoices.InvoicePricing',
          to: EXCHANGE_RATES,
          name: 'rates',
        },
        {
          kind: 'has_input',
          from: 'behavior|billing.invoices.Invoice.totalIn',
          to: EXCHANGE_RATES,
          name: 'rates',
          cardinality: '1',
          position: 2,
        },
        {
          kind: 'has_input',
          from: 'behavior|billing.rates.FixedExchangeRates.convert',
          to: MONEY,
          name: 'money',
          cardinality: '1',
          position: 1,
        },
        {
          kind: 'has_output',
          from: 'behavior|billing.invoices.Invoice.totalIn',
          to: MONEY,
          cardinality: '1',
        },
        {
          kind: 'has_output',
          from: 'behavior|billing.invoices.InvoicePricing.priceIn',
          to: MONEY,
          cardinality: '1',
        },
        {
          kind: 'has_output',
          from: 'behavior|billing.rates.FixedExchangeRates.convert',
          to: MONEY,
          cardinality: '1',
        },
        {
          kind: 'has_state',
          from: 'building_block|billing.invoices.Invoice',
          to: MONEY,
          name: 'total',
          cardinality: '1',
        },
      ]);
      // A listed block has no behaviors of its own (R14.1).
      expect<unknown>(
        model.relations.filter(
          (r) => r.kind === 'exposes' && listed.has(r.from),
        ),
      ).toEqual([]);
    },
    SCAN_BUDGET_MS,
  );
});
