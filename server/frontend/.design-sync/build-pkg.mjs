#!/usr/bin/env node
// Packages src/shared/design-system as a stand-in npm package in .ds-pkg/ so
// the design-sync converter can consume it: a barrel entry (index.ts, bundled
// by the converter's esbuild) plus a .d.ts tree emitted by tsc. The design
// system lives inside the app and has no build of its own; this is that build.
// Run from server/frontend: node .design-sync/build-pkg.mjs
import { execFileSync } from 'node:child_process';
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from 'node:fs';

const DS = 'src/shared/design-system';
const OUT = '.ds-pkg';
// Internal helpers and side-effect modules stay out of the public surface.
const SKIP = new Set([
  'wrap-component.ts',
  'create-polymorphic-wrapper.ts',
  'styles.ts',
  'mantine.d.ts',
  // A provider that moves portals; it draws nothing to preview.
  'portal-target.tsx',
]);

rmSync(OUT, { recursive: true, force: true });
mkdirSync(OUT);
// styles.ts imports Mantine's stylesheet as a side effect; the converter only
// reads CSS from inside the package, so ship a copy alongside the entry.
copyFileSync('node_modules/@mantine/core/styles.css', `${OUT}/styles.css`);
const modules = readdirSync(DS)
  .filter((f) => /\.tsx?$/.test(f) && !SKIP.has(f))
  .sort();
writeFileSync(
  `${OUT}/index.ts`,
  modules
    .map((f) => `export * from '../${DS}/${f.replace(/\.tsx?$/, '')}';`)
    .join('\n') + '\n',
);
writeFileSync(
  `${OUT}/package.json`,
  JSON.stringify(
    {
      name: '@noesis/design-system',
      version: '0.0.0',
      private: true,
      type: 'module',
      module: 'index.ts',
      types: 'dist/.ds-pkg/index.d.ts',
    },
    null,
    2,
  ) + '\n',
);
writeFileSync(
  `${OUT}/tsconfig.json`,
  JSON.stringify(
    {
      extends: '../tsconfig.app.json',
      compilerOptions: {
        noEmit: false,
        declaration: true,
        emitDeclarationOnly: true,
        outDir: 'dist',
        rootDir: '..',
        types: [],
        tsBuildInfoFile: null,
      },
      include: ['index.ts', `../${DS}/mantine.d.ts`],
    },
    null,
    2,
  ) + '\n',
);
// tsc reports TS2883 ("inferred type cannot be named") for wrappers built
// with Object.assign over Mantine statics and skips their .d.ts. Any other
// error fails the build; those two get the hand-written fallbacks below.
let tscOut = '';
try {
  execFileSync('node_modules/.bin/tsc', ['-p', `${OUT}/tsconfig.json`], {
    encoding: 'utf8',
  });
} catch (e) {
  tscOut = String(e.stdout ?? '');
  const errors = tscOut.split('\n').filter((l) => /error TS\d+/.test(l));
  const fatal = errors.filter((l) => !l.includes('error TS2883'));
  if (fatal.length || !errors.length) {
    console.error(tscOut || e.message);
    process.exit(1);
  }
}

const FALLBACK_DTS = {
  'button.d.ts': `import type { Button as MantineButton, ButtonProps as MantineButtonProps, PolymorphicComponentProps } from '@mantine/core';
export interface ButtonProps extends MantineButtonProps {
    /** Shows the loader and disables the button while an action runs. */
    busy?: boolean;
}
export declare const Button: (<C = 'button'>(props: PolymorphicComponentProps<C, ButtonProps>) => React.ReactElement) & Pick<typeof MantineButton, 'extend' | 'classes' | 'Group' | 'GroupSection'>;
`,
  'menu.d.ts': `import type { Menu as MantineMenu } from '@mantine/core';
export declare const Menu: ((props: import('@mantine/core').MenuProps) => React.ReactElement) & Pick<typeof MantineMenu, 'Target' | 'Dropdown' | 'Item' | 'Label' | 'Divider'>;
`,
};
const dtsDir = `${OUT}/dist/${DS}`;
for (const [file, body] of Object.entries(FALLBACK_DTS)) {
  if (!existsSync(`${dtsDir}/${file}`)) {
    writeFileSync(`${dtsDir}/${file}`, body);
    console.log(`fallback .d.ts: ${file}`);
  }
}
const missing = modules
  .map((f) => f.replace(/\.tsx?$/, '.d.ts'))
  .filter((f) => !existsSync(`${dtsDir}/${f}`));
if (missing.length) {
  console.error(`no .d.ts emitted for: ${missing.join(', ')}`);
  process.exit(1);
}
console.log(`${OUT}: ${modules.length} modules`);
