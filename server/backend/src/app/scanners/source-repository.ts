/** The repository a scan reads: its name and the commit checked out. */
export interface SourceRepository {
  readonly name: string;
  /** Null when the repository has no commit to name. */
  headCommit(): Promise<string | null>;
}
