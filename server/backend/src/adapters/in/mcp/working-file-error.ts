/**
 * A working file the agent passed that cannot be read or does not fit its
 * schema. `subject` is what the file was meant to hold, as the tool names it.
 */
export class WorkingFileError extends Error {
  readonly subject: string;
  readonly reason: string;

  constructor(subject: string, reason: string) {
    super(`Could not read the ${subject}:\n${reason}`);
    this.name = 'WorkingFileError';
    this.subject = subject;
    this.reason = reason;
  }
}
