/**
 * What handles one command or query. Adapters depend on this rather than on a
 * handler class, so a spec can hand them a fake.
 */
export interface Handler<Input, Output> {
  handle(input: Input): Promise<Output>;
}
