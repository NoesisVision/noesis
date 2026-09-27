import { Hono } from 'hono';
import { streamSSE } from 'hono/streaming';

/** An attach stream, as the daemon counting sessions sees it. */
export interface HeldStream {
  onAbort(listener: () => void): void;
}

export interface Attachments {
  /** Resolves when the stream is to end: its session left, or the daemon goes. */
  hold(stream: HeldStream): Promise<void>;
}

export interface InternalDeps {
  version: string;
  /** Minted at each boot, so a caller knows which daemon answered. */
  instance: string;
  attachments: Attachments;
  /** Where the page is served, once the server listens. */
  url: () => string;
  /** Lifts the server's idle timeout for a request that stays open. */
  keepOpen: (request: Request) => void;
}

// The e2e specs wait on the literal `/internal/health`.
export function createInternalApp(deps: InternalDeps) {
  const { version, instance, attachments } = deps;
  return new Hono()
    .get('/health', (c) => c.json({ status: 'ok' as const, version, instance }))
    .get('/attach', (c) => {
      deps.keepOpen(c.req.raw);
      return streamSSE(c, async (stream) => {
        const held = attachments.hold(stream);
        await stream.writeSSE({
          event: 'attached',
          data: JSON.stringify({ url: deps.url(), instance }),
        });
        await held;
      });
    });
}
