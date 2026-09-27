import {
  isJSONRPCRequest,
  type JSONRPCMessage,
  type Transport,
} from '@modelcontextprotocol/server';
import { StdioServerTransport } from '@modelcontextprotocol/server/stdio';

export interface ServingHooks {
  /** Any message at all, the probe's included: the host is speaking. */
  onFirstMessage?: () => void;
  /** The first message that is not the era probe's. */
  onServing: () => void;
}

/** The era probe's one and only request. */
const DISCOVER = 'server/discover';

/**
 * The process's stdio, with one thing observed: whether this process serves a
 * session or is the SDK's throwaway era probe.
 *
 * The probe receives `server/discover` and nothing else before it is reaped,
 * and the process that goes on to serve never receives it at all — on the
 * modern era the client takes the era, the capabilities and the instructions
 * from the probe's answer and sends no `initialize`. So the first message that
 * is not `server/discover` is the proof that this process has work to do. A
 * host that probes in place, on one process, reaches the same conclusion one
 * message later; a 2025-era host reaches it on `initialize`.
 */
export class ServingTransport implements Transport {
  private readonly wire: StdioServerTransport;
  private readonly hooks: ServingHooks;
  private heard = false;
  private serving = false;

  constructor(hooks: ServingHooks, wire = new StdioServerTransport()) {
    this.hooks = hooks;
    this.wire = wire;
  }

  onclose?: Transport['onclose'];
  onerror?: Transport['onerror'];
  onmessage?: Transport['onmessage'];

  async start(): Promise<void> {
    this.wire.onclose = () => this.onclose?.();
    this.wire.onerror = (error) => this.onerror?.(error);
    // The stdio wire carries no per-message extra: one channel, no headers.
    this.wire.onmessage = (message: JSONRPCMessage) => {
      this.notice(message);
      this.onmessage?.(message);
    };
    await this.wire.start();
  }

  /** stdio shares one channel, so there is nothing per-request to carry. */
  async send(message: JSONRPCMessage): Promise<void> {
    await this.wire.send(message);
  }

  async close(): Promise<void> {
    await this.wire.close();
  }

  private notice(message: JSONRPCMessage): void {
    if (!this.heard) {
      this.heard = true;
      this.hooks.onFirstMessage?.();
    }
    if (this.serving) return;
    if (isJSONRPCRequest(message) && message.method === DISCOVER) return;
    this.serving = true;
    this.hooks.onServing();
  }
}
