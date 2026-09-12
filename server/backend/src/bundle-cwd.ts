// Bun resolves the asset paths in a built HTML bundle's manifest against the
// working directory, not against the bundle file, so the built bin dies at
// load when launched from anywhere but dist/ — and bunx launches it from the
// user's project. Switching to the bundle's own directory before the manifest
// loads fixes that; this module is main.ts's first import for exactly that
// reason (imports evaluate in order). The launch directory is kept for
// repository-root discovery. Running from source bundles index.html on the
// fly and needs neither.
export const launchCwd = process.cwd();

if (process.env.NODE_ENV === 'production') {
  process.chdir(import.meta.dir);
}
