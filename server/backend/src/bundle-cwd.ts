// Bun resolves a built HTML bundle's asset paths against the working
// directory, not the bundle file, and bunx launches the bin from the user's
// project. So this module is main.ts's first import.
export const launchCwd = process.cwd();

if (process.env.NODE_ENV === 'production') {
  process.chdir(import.meta.dir);
}
