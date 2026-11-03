import type { FeatureFileSource } from './feature-files/feature-file';

/** The repository a scan reads: its name, the commit checked out and its feature files. */
export interface SourceRepository {
  readonly name: string;
  /** Null when the repository has no commit to name. */
  headCommit(): Promise<string | null>;
  /** Every `*.feature` file the repository tracks, by its path from the root; none outside Git. */
  featureFiles(): Promise<FeatureFileSource[]>;
}
