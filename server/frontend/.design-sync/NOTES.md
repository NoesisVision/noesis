# design-sync notes (Noesis design system → claude.ai/design)

Run everything from `server/frontend`.

## Build
- The design system is a folder inside the app (`src/shared/design-system`), not a package. `node .design-sync/build-pkg.mjs` (`cfg.buildCmd`) packages it into gitignored `.ds-pkg/`: a barrel `index.ts` (every module except `wrap-component`, `create-polymorphic-wrapper`, `styles`, `mantine.d.ts`), a copy of `@mantine/core/styles.css`, and a `.d.ts` tree from `tsc`. Re-run it before every converter run.
- The package tsconfig keeps `types: ['vite/client']`: `theme.ts` imports `theme.module.css`, and without vite's declaration tsc fails with TS2307 (and Button/Menu then lose their fallback `.d.ts`, so the diff reports them removed). Check `node .design-sync/build-pkg.mjs`'s own exit code - piping it through `tail` hides a failure.
- tsc reports TS2883 for `button.tsx` and `menu.tsx` (Object.assign over Mantine statics) and emits no `.d.ts` for them; `build-pkg.mjs` writes hand-written fallbacks. If the wrapper API of Button/Menu changes, update `FALLBACK_DTS` there. Any other tsc error fails the build.
- Converter: `node .ds-sync/package-build.mjs --config .design-sync/config.json --node-modules ./node_modules --out ./ds-bundle` (`cfg.entry` points at `.ds-pkg/index.ts`).
- `cssEntry`/`extraFonts` paths are relative to the package dir (`.ds-pkg/`) and must stay inside the workspace; Mantine CSS is copied into `.ds-pkg/` because the converter refuses a cssEntry outside the package.
- `.design-sync/overrides/dts.mjs` forks lib/dts.mjs: the stock style-system filter flags all of `@mantine/core` and drops every Mantine prop (variant, size, color...). The fork keeps `@mantine/*` props except `Box/style-props` (m, p, bg, c, w...). Needs `ln -sfn ../.ds-sync/node_modules .design-sync/node_modules` on a fresh clone.
- `@tabler/icons-react` is merged into `window.NoesisDS` via `extraEntries` (user's choice) - bundle ~5.7 MB. Previews import icons from `@noesis/design-system` too, never from `@tabler/icons-react` directly (that would re-bundle the icon set per preview).
- Provider: `MantineProvider` with `theme` = `$ref` to the exported `theme` (theme.ts), `defaultColorScheme: light`.
- Playwright chromium installed to ~/Library/Caches/ms-playwright (via `.ds-sync` npx playwright install chromium).

## Previews
- Overlays (Menu, Modal, Tooltip, ...) render with `defaultOpened`/`opened` + `withinPortal={false}` and a `cardMode: single` + viewport override in config.
- `Button busy` hides the label behind the loader - expected Mantine behavior.
- Tooltip card (360x200): a `position="right"` tooltip with a long label clips at the right edge; keep targets narrow or position top/bottom.
- The app's custom icons (`src/shared/ui/icons/icons.ts`: `IconChevronsUpDown`, `IconChevronsDownUp`) ship via `extraEntries` and sit on `window.NoesisDS` beside Tabler's.
- AppShell preview uses `mode="static"` with `h={460}` (560 overflows the 960x560 card).
- Modal preview: no `centered`, `yOffset={16}`, `transitionProps={{duration:0}}`, short content - otherwise the title clips in the 640x420 card. The close button shows its autofocus ring (expected).
- MantineProvider DarkScheme preview: a nested provider with only `forceColorScheme="dark"` stays light because the harness's outer provider owns `<html>`'s scheme attribute. The preview scopes it: `cssVariablesSelector="#noesis-dark-scope"`, `deduplicateCssVariables={false}`, `withGlobalClasses={false}`, `getRootElement` -> that element, plus a wrapper div with that id, `data-mantine-color-scheme="dark"` and `background: var(--mantine-color-body)`. Harness-only; real apps use one provider with `defaultColorScheme`.
- A missing icon name renders a silently blank cell (no error cell) - check `window.NoesisDS.Icon*` names exist before using them.
- Accordion with inline badges in the control needs `maw={600}`, or the xs badge truncates.

## Known render warns (triaged, benign)
- `[TOKENS_MISSING]` (~69 vars: `--affix-*`, `--app-shell-*`, `--mantine-text-wrap`, `--mantine-color-brand-4/-6`...) - set at runtime by MantineProvider / component inline styles. Verified `--mantine-color-brand-6`, `--mantine-spacing-md`, `--mantine-radius-sm`, `--mantine-color-dimmed`, `--mantine-color-body` resolve in a rendered card. A `--noesis-tone-*` var in this list is NOT benign: those come from the app's `page-tone.css`, which the DS does not ship - give the DS rule a fallback (theme.module.css's segmented icon falls back to brand 6 / 4, 2026-10-29).
- `[RENDER_THIN]` Modal - fixed-position overlay measures 0px; screenshot shows the full dialog.
- `[GRID_OVERFLOW]` fixed with `cardMode: column` for Grid, Group, MantineProvider, TextInput, Chip.

## Re-sync risks
- `FALLBACK_DTS` in build-pkg.mjs hand-describes Button and Menu; it silently drifts if their wrappers gain props/statics.
- `.design-sync/overrides/dts.mjs` is a fork of the converter's lib/dts.mjs - diff against the bundled copy on each re-sync.
- The build reads `tsconfig.app.json`; if it gains options incompatible with `emitDeclarationOnly`, build-pkg.mjs breaks.
- Previews mirror app compositions (shell, change picker, dev-tools modal, scenario accordion) - they don't update when those screens change.
- Mantine module augmentation (`mantine.d.ts`, the `brand` colour) isn't seen by the d.ts extractor, so `color` unions omit `"brand"`; the conventions header documents it instead.
- New wrapper modules in src/shared/design-system are picked up automatically by build-pkg.mjs; add a preview for each.
- The provider also gets `cssVariablesResolver` (`$ref` to the export in theme.ts), so the `--noesis-*` variables resolve in previews as in the app.
- `portal-target.tsx` is in `SKIP`: a provider that moves portals, with nothing to draw.
- Design pages crash with "React 19 can't be loaded here" when `support.js` runs before React 19 is on the page: it loads React 18.3.1 from unpkg, on which Mantine 9 cannot render. The conventions header tells pages to load `_ds/<ds>/_vendor/react.js` first. Claude Design does not copy `_vendor/` into a project's `_ds/` folder, so a page in another project needs the file uploaded there too (done by hand for "Segmented Control" and "Navigation Proposals" on 2026-10-16). A React version bump re-ships `_vendor/react.js` here, but not those copies.
- conventions.md drift (2026-10-23): it says `Card` ships `radius="md"`; since the app-redesign branch the wrapper's default is `radius: 18` (every card, pane and dropdown rounded alike). Proposed to the user, not yet edited.
- 2026-10-29 re-sync (PR #99): `FloatingIndicator` wrapper removed from the DS and deleted remotely (5 files); 16 components regraded (theme tokens moved). The AppShell preview now draws the brand-book v4 mark inline (a copy of `src/shell/noesis-mark.tsx`'s paths, as that is not a DS module) with the 18px wordmark, the settings button and the rail tint; if the mark changes, update both.
