// Stands in for `noesis-scan-csharp` in the C# scanner's unit tests. Its own
// flags come first, the scanner's follow: `--source <dir>` copies that
// directory's committed code-model/ into `--out`, `--fail <code>` exits with
// that code instead, `--record <file>` writes the arguments there. The real
// tool runs in test/e2e/csharp-scanner.e2e.spec.ts.
import { cp, mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const args = process.argv.slice(2);
const after = (flag: string): string | undefined => {
  const at = args.indexOf(flag);
  return at === -1 ? undefined : args[at + 1];
};

const out = after('--out');
if (out === undefined) {
  console.error('fake-scan-csharp: no --out');
  process.exit(1);
}
await mkdir(out, { recursive: true });
const record = after('--record');
if (record !== undefined) await writeFile(record, JSON.stringify(args));

const exitCode = Number(after('--fail') ?? '0');
if (exitCode !== 0) {
  console.error('fake-scan-csharp: failing as asked');
  process.exit(exitCode);
}
const source = after('--source');
if (source !== undefined) {
  await cp(join(source, 'code-model'), join(out, 'code-model'), {
    recursive: true,
  });
}
console.log(`fake-scan-csharp: wrote ${out}`);
