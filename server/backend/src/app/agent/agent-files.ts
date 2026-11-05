/** Where a file the person hands the session is kept, so the agent can read it by path. */
export interface AgentFiles {
  /** Writes the bytes under `name` and answers the absolute path the agent reads. */
  save(name: string, bytes: Uint8Array): Promise<string>;
}
