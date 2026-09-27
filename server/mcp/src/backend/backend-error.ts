/**
 * The repository's backend could not take a call: it could not be started or
 * reached, it runs another version, or it holds the lock without answering.
 * The message says what to do; `logged` answers it in-band as it is.
 */
export class BackendError extends Error {
  private constructor(message: string) {
    super(message);
    this.name = 'BackendError';
  }

  static unreachable(reason: string): BackendError {
    return new BackendError(
      `The Noesis service could not be started or reached: ${reason} Nothing was written. Call again; if it keeps failing, .noesis/logs/noesis-serve.log says why.`,
    );
  }

  static otherVersion(running: string, own: string): BackendError {
    return new BackendError(
      `The Noesis service running for this repository is version ${running}, this session is ${own}. Nothing was written. Ask the user to run \`noesis stop\` in the repository, then call again: the next call starts the matching version.`,
    );
  }

  static notAnswering(pid: number): BackendError {
    return new BackendError(
      `The Noesis service (pid ${pid}) holds this repository but does not answer. Nothing was written. Ask the user to run \`noesis stop\` in the repository, then call again.`,
    );
  }
}
