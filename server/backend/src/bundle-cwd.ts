// Captured before anything else runs: bunx launches the bin from the user's
// project, and the repository root is resolved against where the process was
// started rather than wherever it stands later. main.ts's first import after
// the stdout guard.
export const launchCwd = process.cwd();
