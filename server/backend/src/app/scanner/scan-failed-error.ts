/**
 * The scanner could not deliver a model: no scanner configured, the tool
 * missing, the code model unreadable. The message is the scanner's own, so
 * whoever asked for the scan can read why; the adapters answer it as such.
 */
export class ScanFailedError extends Error {
  constructor(cause: unknown) {
    super(cause instanceof Error ? cause.message : String(cause), { cause });
    this.name = 'ScanFailedError';
  }
}
