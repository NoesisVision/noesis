import { serverLogger } from '../logging/logging.js';
import type { SystemModelRepository } from '../system-model/system-model.repository.js';
import type { LanguageScanner } from './language-scanner.js';
import { languageScanners } from './languages/index.js';

const log = serverLogger('scanner');

export interface ScanReport {
  /** Units (a package.json, a pom.xml…) that had source files. */
  units: {
    scanner: string;
    name: string;
    path: string;
    buildingBlocks: number;
  }[];
  /** System-model files removed because their unit is gone. */
  removed: string[];
  durationMs: number;
}

export interface ScannerOptions {
  /** The language scanners to run; every language by default. */
  scanners?: readonly LanguageScanner[];
  /** The clock, injected so ids and output are testable. */
  now?: () => string;
}

/**
 * The scanner as a service component: runs every language scanner over the
 * checkout, writes one system-model file per unit and drops the files of
 * units that no longer exist. Which scanner handles what is decided by the
 * units each one finds, so a polyglot repository needs no configuration.
 * The graph projection is not written here — the watcher sees the files and
 * re-indexes, the same path every other kind takes (decision 68).
 */
export class ScannerService {
  private readonly root: string;
  private readonly systemModels: SystemModelRepository;
  private readonly scanners: readonly LanguageScanner[];
  private readonly now: () => string;

  constructor(
    root: string,
    systemModels: SystemModelRepository,
    options: ScannerOptions = {},
  ) {
    this.root = root;
    this.systemModels = systemModels;
    this.scanners = options.scanners ?? languageScanners;
    this.now = options.now ?? (() => new Date().toISOString());
  }

  async scan(): Promise<ScanReport> {
    const started = performance.now();
    const written = new Set<string>();
    const report: ScanReport = { units: [], removed: [], durationMs: 0 };

    for (const scanner of this.scanners) {
      const units = await scanner.findUnits(this.root);
      for (const unit of units) {
        const sources = await scanner.findSources(unit, units);
        if (sources.length === 0) continue;
        const model = await scanner.scanUnit(unit, sources, {
          root: this.root,
          now: this.now,
        });
        const stored = await this.systemModels.write(model);
        written.add(model.id);
        report.units.push({
          scanner: scanner.name,
          name: model.name,
          path: stored.path,
          buildingBlocks: model.buildingBlocks.length,
        });
      }
    }

    for (const stale of await this.systemModels.list()) {
      if (written.has(stale.entity.id)) continue;
      await this.systemModels.remove(stale.entity.id);
      report.removed.push(stale.entity.name);
    }

    report.durationMs = Math.round(performance.now() - started);
    log.info('scanned {units} unit(s) in {durationMs} ms', {
      units: report.units.length,
      durationMs: report.durationMs,
    });
    return report;
  }
}
