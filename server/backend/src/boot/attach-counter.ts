import type {
  Attachments,
  HeldStream,
} from '#backend/adapters/in/ui/internal.routes';
import { serverLogger } from '#backend/platform/logging/server-logger';

const log = serverLogger('attach');

export interface AttachCounterOptions {
  /** `null` when nobody attaching is no reason to exit: a daemon started by hand. */
  graceMs: number | null;
  /** Nobody attached for the grace period. */
  onIdle: () => void;
}

/**
 * The sessions attached to this daemon, one open stream each. A managed
 * daemon exits once none has been attached for the grace period, counted
 * from boot as well as from the last detach.
 */
export class AttachCounter implements Attachments {
  private readonly options: AttachCounterOptions;
  private readonly streams = new Map<HeldStream, () => void>();
  private timer: ReturnType<typeof setTimeout> | undefined;
  private closing = false;

  constructor(options: AttachCounterOptions) {
    this.options = options;
  }

  get count(): number {
    return this.streams.size;
  }

  /** Arms the grace timer at boot, before anybody attaches. */
  startGrace(): void {
    if (this.count === 0) this.armGrace();
  }

  /** Resolves once the stream is aborted by its session or closed by `closeAll()`. */
  hold(stream: HeldStream): Promise<void> {
    return new Promise((resolve) => {
      const end = () => {
        if (!this.streams.delete(stream)) return;
        log.info('a session detached ({sessions} attached)', {
          sessions: this.count,
        });
        if (this.count === 0 && !this.closing) this.armGrace();
        resolve();
      };
      this.streams.set(stream, end);
      this.disarmGrace();
      log.info('a session attached ({sessions} attached)', {
        sessions: this.count,
      });
      stream.onAbort(end);
    });
  }

  /** Ends every stream held; the grace timer stays off, since the daemon is going. */
  closeAll(): void {
    this.closing = true;
    this.disarmGrace();
    for (const end of this.streams.values()) end();
  }

  private armGrace(): void {
    const { graceMs, onIdle } = this.options;
    if (graceMs === null) return;
    this.disarmGrace();
    this.timer = setTimeout(() => {
      log.info('no session attached for {graceMs} ms — shutting down', {
        graceMs,
      });
      onIdle();
    }, graceMs);
  }

  private disarmGrace(): void {
    clearTimeout(this.timer);
    this.timer = undefined;
  }
}
