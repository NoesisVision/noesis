import type { Lifecycle } from '#backend/boot/lifecycle';
import type { ServerConfig } from '#backend/platform/config/config';
import { serverLogger } from '#backend/platform/logging/server-logger';

const log = serverLogger('host');

/** What of stdin the watch needs: its end, its failure, and a way to let go of it. */
interface WatchedInput {
  once(event: 'end', listener: () => void): unknown;
  once(event: 'error', listener: (error: Error) => void): unknown;
  destroy(): unknown;
}

export interface HostWatchOptions {
  stdin: WatchedInput;
  readPpid: () => number;
  /** `0` never polls. */
  ppidPollMs: number;
  /** `0` never gives up on the first message. */
  startupTimeoutMs: number;
  /** Runs once, after the reason is logged. */
  onHostGone: (reason: string) => void;
}

/**
 * Ends a session whose host is gone. A shim that outlives its host keeps its
 * attach stream open, and with it the backend, forever; the end of stdin is
 * not the only way a host goes. A socketpair stdin, which Claude Code uses,
 * reports `ECONNRESET` and never `end`; a host that dies reparents the shim;
 * a host that abandons a launch during its probe keeps the pipe open and
 * never writes.
 */
export class HostWatch {
  private readonly options: HostWatchOptions;
  private readonly initialPpid: number;
  private poll: ReturnType<typeof setInterval> | undefined;
  private startup: ReturnType<typeof setTimeout> | undefined;
  private gone = false;

  constructor(options: HostWatchOptions) {
    this.options = options;
    this.initialPpid = options.readPpid();
  }

  start(): void {
    this.watchStdin();
    this.pollParent();
    this.armStartupTimer();
  }

  /** The host spoke: it did not abandon this launch. */
  noticeInput(): void {
    clearTimeout(this.startup);
    this.startup = undefined;
  }

  stop(): void {
    clearInterval(this.poll);
    this.noticeInput();
  }

  private watchStdin(): void {
    const { stdin } = this.options;
    stdin.once('end', () => this.hostGone('the MCP stream closed'));
    stdin.once('error', (error) =>
      this.hostGone(`the MCP stream failed (${error.message})`),
    );
  }

  private pollParent(): void {
    const { ppidPollMs, readPpid } = this.options;
    if (ppidPollMs === 0) return;
    this.poll = setInterval(() => {
      const ppid = readPpid();
      if (ppid === this.initialPpid) return;
      this.hostGone(
        `the host (pid ${this.initialPpid}) is gone; this process now belongs to pid ${ppid}`,
      );
    }, ppidPollMs);
    this.poll.unref();
  }

  private armStartupTimer(): void {
    const { startupTimeoutMs } = this.options;
    if (startupTimeoutMs === 0) return;
    this.startup = setTimeout(() => {
      this.hostGone(
        `the host sent nothing within ${startupTimeoutMs} ms of the launch`,
      );
    }, startupTimeoutMs);
    this.startup.unref();
  }

  private hostGone(reason: string): void {
    if (this.gone) return;
    this.gone = true;
    this.stop();
    // Destroyed, the descriptor leaves the event loop and cannot spin it.
    this.options.stdin.destroy();
    log.info('{reason} — shutting down', { reason });
    this.options.onHostGone(reason);
  }
}

/** Ends this session, through `lifecycle`, once its host is gone. */
export function watchHost(
  config: ServerConfig,
  lifecycle: Lifecycle,
): HostWatch {
  return new HostWatch({
    stdin: process.stdin,
    readPpid: () => process.ppid,
    ppidPollMs: config.ppidPollMs,
    startupTimeoutMs: config.startupTimeoutMs,
    onHostGone: () => void lifecycle.shutdown(),
  });
}
