/**
 * What handles one command or query. Each use case has a factory that closes
 * over what it needs and returns one; adapters depend on this interface, so a
 * spec can hand them a fake.
 */
export interface Handler<Input, Output> {
  handle(input: Input): Promise<Output>;
}
