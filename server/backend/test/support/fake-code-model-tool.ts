// Stands in for a code model tool (`noesis-scan-csharp`, `mvn … noesis:scan`)
// in the scanner adapters' unit tests. Its own flags come first, the
// adapter's follow: `--source <dir>` copies that directory's committed
// code-model/ into the output directory (`--out <dir>`, Maven's `-Dnoesis.out=<dir>` or
// Gradle's `-Pnoesis.out=<dir>`),
// `--fail <code>` exits with that code instead. The arguments are recorded
// in `fake-scan-args.json` in the working directory, the repository root,
// since the output directory is removed after the scan. The real tools run
// in test/e2e.
import { cp, mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const args = process.argv.slice(2);
const after = (flag: string): string | undefined => {
  const at = args.indexOf(flag);
  return at === -1 ? undefined : args[at + 1];
};

const out =
  after('--out') ??
  args
    .find((arg) => /^-[DP]noesis\.out=/.test(arg))
    ?.slice('-Dnoesis.out='.length);
if (out === undefined) {
  console.error('fake-code-model-tool: no output directory');
  process.exit(1);
}
await mkdir(out, { recursive: true });
await writeFile(
  join(process.cwd(), 'fake-scan-args.json'),
  JSON.stringify(args),
);

const exitCode = Number(after('--fail') ?? '0');
if (exitCode !== 0) {
  console.error('fake-code-model-tool: failing as asked');
  process.exit(exitCode);
}
const source = after('--source');
if (source !== undefined) {
  await cp(join(source, 'code-model'), join(out, 'code-model'), {
    recursive: true,
  });
}
console.log(`fake-code-model-tool: wrote ${out}`);
