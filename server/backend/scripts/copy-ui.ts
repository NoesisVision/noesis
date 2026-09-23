// The SPA is built by vite and copied in beside the bundle, because the
// service serves it from disk rather than carrying it inside main.js.
import { cp, rm } from 'node:fs/promises';
import { join } from 'node:path';

const source = join(import.meta.dir, '../../frontend/dist');
const target = join(import.meta.dir, '../dist/ui');

if (!(await Bun.file(join(source, 'index.html')).exists())) {
  console.error(`[build] no built page in ${source}`);
  process.exit(1);
}

await rm(target, { recursive: true, force: true });
await cp(source, target, { recursive: true });
console.log(`[build] page copied into ${target}`);
