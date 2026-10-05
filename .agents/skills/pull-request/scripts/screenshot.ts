#!/usr/bin/env bun
// Captures a page of the running app as a PNG, for a pull request that
// changes what the UI looks like. Run the app first (see ../SKILL.md).
//
// Usage: bun screenshot.ts --url <url> --out <file.png>
//          [--width 1440] [--height 900] [--scheme light|dark]
//          [--selector <css>] [--hover <css>] [--scale 2]
//
// --selector crops the shot to one element (the header, a panel) instead of
// the viewport; --hover points at an element first, for a hover state. The
// colour scheme goes in through the app's own storage key, before the page
// loads, so the first paint is already in that scheme.
//
// Needs a Chromium for playwright-core, installed once with
// `bunx playwright-core install chromium-headless-shell`.
import { parseArgs } from 'node:util';
import { chromium } from 'playwright-core';

const { values } = parseArgs({
  options: {
    url: { type: 'string' },
    out: { type: 'string' },
    width: { type: 'string', default: '1440' },
    height: { type: 'string', default: '900' },
    scheme: { type: 'string', default: 'light' },
    selector: { type: 'string' },
    hover: { type: 'string' },
    scale: { type: 'string', default: '2' },
  },
});

if (!values.url || !values.out) {
  console.error('usage: bun screenshot.ts --url <url> --out <file.png> [...]');
  process.exit(2);
}
if (values.scheme !== 'light' && values.scheme !== 'dark') {
  console.error('--scheme is light or dark');
  process.exit(2);
}

// The key `index.html` and the theme read the scheme from.
const COLOR_SCHEME_KEY = 'noesis.shell.colorScheme';

const browser = await chromium.launch().catch((error: unknown) => {
  console.error(
    'No Chromium for playwright-core. Install it once with:\n' +
      '  bunx playwright-core install chromium-headless-shell',
  );
  throw error;
});
try {
  const page = await browser.newPage({
    viewport: { width: Number(values.width), height: Number(values.height) },
    deviceScaleFactor: Number(values.scale),
  });
  await page.addInitScript(
    ([key, scheme]) => localStorage.setItem(key, scheme),
    [COLOR_SCHEME_KEY, values.scheme] as const,
  );
  await page.goto(values.url, { waitUntil: 'networkidle' });
  if (values.hover) await page.hover(values.hover);
  // Fonts and the layout effects that measure them settle after load.
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(300);
  if (values.selector) {
    await page.locator(values.selector).first().screenshot({ path: values.out });
  } else {
    await page.screenshot({ path: values.out });
  }
  console.log(values.out);
} finally {
  await browser.close();
}
