import { type FSWatcher, watch } from 'node:fs';
import { serverLogger } from '#backend/platform/logging/logging';
import type { NoesisDir } from './noesis-dir';

const log = serverLogger('watcher');

export interface WatcherOptions {
  debounceMs?: number;
}

/**
 * Reacts to every change, not only the service's own writes: a `git checkout`
 * or a hand edit must re-index too. A change during a rebuild queues exactly
 * one more, so the graph ends up reflecting the last state of the files.
 * `.tmp` files are ignored because the rename that follows reports the target.
 */
export class NoesisWatcher {
  private readonly noesis: NoesisDir;
  private readonly rebuild: () => Promise<unknown>;
  private readonly debounceMs: number;
  private watcher: FSWatcher | null = null;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private dirty = false;
  private running: Promise<void> | null = null;

  constructor(
    noesis: NoesisDir,
    rebuild: () => Promise<unknown>,
    options: WatcherOptions = {},
  ) {
    this.noesis = noesis;
    this.rebuild = rebuild;
    this.debounceMs = options.debounceMs ?? 100;
  }

  start(): void {
    if (this.watcher !== null) return;
    this.watcher = watch(
      this.noesis.path,
      { recursive: true, persistent: false },
      (_event, filename) => this.onEvent(filename),
    );
    this.watcher.on('error', (error) => {
      log.error('watch failed: {error}', { error: String(error) });
    });
  }

  close(): void {
    if (this.timer !== null) clearTimeout(this.timer);
    this.timer = null;
    this.watcher?.close();
    this.watcher = null;
  }

  /** Resolves once every rebuild the events so far called for has finished. */
  async settle(): Promise<void> {
    while (this.timer !== null || this.running !== null) {
      if (this.timer !== null) {
        await new Promise((r) => setTimeout(r, this.debounceMs));
      }
      await this.running;
    }
  }

  private onEvent(filename: string | Buffer | null): void {
    if (filename !== null && isIgnored(String(filename))) return;
    this.dirty = true;
    if (this.timer !== null) clearTimeout(this.timer);
    this.timer = setTimeout(() => {
      this.timer = null;
      this.flush();
    }, this.debounceMs);
  }

  private flush(): void {
    if (this.running !== null) return; // the running loop re-checks `dirty`
    this.running = (async () => {
      while (this.dirty) {
        this.dirty = false;
        try {
          await this.rebuild();
        } catch (error) {
          log.error('re-index failed: {error}', { error: String(error) });
        }
      }
    })().finally(() => {
      this.running = null;
    });
  }
}

/** Paths relative to `.noesis/`, as `fs.watch` reports them. */
export function isIgnored(relativePath: string): boolean {
  const path = relativePath.replaceAll('\\', '/');
  return (
    path === 'sessions' ||
    path.startsWith('sessions/') ||
    path === '.gitignore' ||
    path.endsWith('.tmp')
  );
}
