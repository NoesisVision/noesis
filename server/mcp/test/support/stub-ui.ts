import { type NoesisApi, noesisApi } from '#mcp/api/noesis-api';

/** A request the stub received, its body parsed. */
export interface Received {
  method: string;
  path: string;
  body: unknown;
}

/**
 * A stand-in for the backend's `/ui` routes on a loopback port: it records
 * every request and gives each the answer last set, so a spec says what the
 * backend answers and checks what the tool sent.
 */
export class StubUi {
  readonly received: Received[] = [];
  readonly api: NoesisApi;
  private status = 500;
  private body: unknown = { error: 'internal' };
  private readonly server: ReturnType<typeof Bun.serve>;

  constructor() {
    this.server = Bun.serve({
      port: 0,
      hostname: '127.0.0.1',
      fetch: (request) => this.receive(request),
    });
    const origin = `http://127.0.0.1:${this.server.port}`;
    this.api = noesisApi(() => Promise.resolve({ origin, lost: () => {} }));
  }

  answer(status: number, body: unknown): void {
    this.status = status;
    this.body = body;
  }

  stop(): Promise<void> {
    return this.server.stop(true);
  }

  private async receive(request: Request): Promise<Response> {
    const text = await request.text();
    this.received.push({
      method: request.method,
      path: new URL(request.url).pathname,
      body: text === '' ? undefined : JSON.parse(text),
    });
    return Response.json(this.body, { status: this.status });
  }
}
