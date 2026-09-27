import type { UiDeps } from '#backend/adapters/in/ui/ui.routes';
import type { ServerConfig } from '#backend/platform/config/config';
import type { NoesisDir } from '#backend/platform/files/noesis-dir';
import { AttachCounter } from './attach-counter';
import { ServerRegistration } from './registration';
import type { ServerLock } from './server-lock';
import { UiHost } from './ui';

export interface DaemonOptions {
  config: ServerConfig;
  noesis: NoesisDir;
  version: string;
  services: UiDeps;
  /** Started by a shim: exits once no session has been attached for the grace period. */
  managed: boolean;
  /** The grace period ran out; the caller shuts the process down. */
  onIdle: () => void;
}

export type DaemonStart =
  | { started: true; daemon: Daemon }
  | { started: false; owner: ServerLock };

/**
 * The one process per repository that owns the graph and serves the page:
 * registered in `.noesis/server.lock` before it binds, published there once
 * it listens, and counting the sessions attached to it.
 */
export class Daemon {
  private readonly ui: UiHost;
  private readonly attachments: AttachCounter;
  private readonly registration: ServerRegistration;
  private readonly version: string;
  private draining = false;

  private constructor(
    options: DaemonOptions,
    registration: ServerRegistration,
  ) {
    this.registration = registration;
    this.version = options.version;
    this.attachments = new AttachCounter({
      graceMs: options.managed ? options.config.graceMs : null,
      onIdle: options.onIdle,
    });
    this.ui = new UiHost({
      config: options.config,
      services: options.services,
      version: options.version,
      instance: registration.instance,
      attachments: this.attachments,
      draining: () => this.draining,
    });
  }

  /** Takes the repository, or names the daemon that already holds it. */
  static async start(options: DaemonOptions): Promise<DaemonStart> {
    const acquired = await ServerRegistration.acquire(
      options.noesis.serverLockPath,
      crypto.randomUUID(),
    );
    if (!acquired.held) return { started: false, owner: acquired.owner };
    const daemon = new Daemon(options, acquired.registration);
    try {
      await daemon.listen();
    } catch (error) {
      acquired.registration.release();
      throw error;
    }
    return { started: true, daemon };
  }

  get sessions(): number {
    return this.attachments.count;
  }

  /**
   * In order: refuse new requests, end the attach streams, let the requests
   * in flight finish, stop the server, release the registration.
   */
  async shutdown(): Promise<void> {
    this.draining = true;
    this.attachments.closeAll();
    await this.ui.stop();
    this.registration.release();
  }

  private async listen(): Promise<void> {
    await this.ui.listen();
    this.registration.publish({
      port: this.ui.port ?? 0,
      version: this.version,
    });
    this.attachments.startGrace();
  }
}
