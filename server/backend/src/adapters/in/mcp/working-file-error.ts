/** A working file the agent passed that cannot be read or does not fit its schema. */
export class WorkingFileError extends Error {
  constructor(subject: string, reason: string) {
    super(`Could not read the ${subject}:\n${reason}`);
    this.name = 'WorkingFileError';
  }
}
