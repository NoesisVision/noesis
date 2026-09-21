import type { SystemModelStore } from '#backend/adapters/store/system-model.store';
import { serverLogger } from '#backend/platform/logging/logging';
import { findSources, findUnits, scanUnit } from './typescript-scanner';

const log = serverLogger('scanner');

export interface ScanReport {
  units: { name: string; path: string; buildingBlocks: number }[];
  removed: string[];
  durationMs: number;
}

// Writes files only; the watcher re-indexes them.
export class ScannerService {
  private readonly root: string;
  private readonly systemModels: SystemModelStore;
  private readonly now: () => string;

  constructor(
    root: string,
    systemModels: SystemModelStore,
    now: () => string = () => new Date().toISOString(),
  ) {
    this.root = root;
    this.systemModels = systemModels;
    this.now = now;
  }

  async scan(): Promise<ScanReport> {
    const started = performance.now();
    const units = await findUnits(this.root);
    const written = new Set<string>();
    const report: ScanReport = { units: [], removed: [], durationMs: 0 };

    for (const unit of units) {
      const sources = await findSources(unit, units);
      if (sources.length === 0) continue;
      const model = await scanUnit(unit, sources, {
        root: this.root,
        now: this.now,
      });
      await this.systemModels.set(model.id, model);
      written.add(model.id);
      report.units.push({
        name: model.name,
        path: this.systemModels.dataFile(model.id),
        buildingBlocks: model.buildingBlocks.length,
      });
    }

    // Every model first, then the deletions: no removing under the iteration.
    const stale = (await Array.fromAsync(this.systemModels.values())).filter(
      (model) => !written.has(model.id),
    );
    for (const model of stale) {
      await this.systemModels.delete(model.id);
      report.removed.push(model.name);
    }

    report.durationMs = Math.round(performance.now() - started);
    log.info('scanned {units} unit(s) in {durationMs} ms', {
      units: report.units.length,
      durationMs: report.durationMs,
    });
    return report;
  }
}
