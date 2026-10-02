# design-sync notes (Noesis design system → claude.ai/design)

Run everything from `server/frontend`.

## Build
- The design system is a folder inside the app (`src/shared/design-system`), not a package. `node .design-sync/build-pkg.mjs` (`cfg.buildCmd`) packages it into gitignored `.ds-pkg/`: a barrel `index.ts` (every module except `wrap-component`, `create-polymorphic-wrapper`, `styles`, `mantine.d.ts`), a copy of `@mantine/core/styles.css`, and a `.d.ts` tree from `tsc`. Re-run it before every converter run.
- tsc reports TS2883 for `button.tsx` and `menu.tsx` (Object.assign over Mantine statics) and emits no `.d.ts` for them; `build-pkg.mjs` writes hand-written fallbacks. If the wrapper API of Button/Menu changes, update `FALLBACK_DTS` there. Any other tsc error fails the build.
- Converter: `node .ds-sync/package-build.mjs --config .design-sync/config.json --node-modules ./node_modules --out ./ds-bundle` (`cfg.entry` points at `.ds-pkg/index.ts`).
- `cssEntry`/`extraFonts` paths are relative to the package dir (`.ds-pkg/`) and must stay inside the workspace; Mantine CSS is copied into `.ds-pkg/` because the converter refuses a cssEntry outside the package.
- `.design-sync/overrides/dts.mjs` forks lib/dts.mjs: the stock style-system filter flags all of `@mantine/core` and drops every Mantine prop (variant, size, color...). The fork keeps `@mantine/*` props except `Box/style-props` (m, p, bg, c, w...). Needs `ln -sfn ../.ds-sync/node_modules .design-sync/node_modules` on a fresh clone.
- `@tabler/icons-react` is merged into `window.NoesisDS` via `extraEntries` (user's choice) - bundle ~5.7 MB. Previews import icons from `@noesis/design-system` too, never from `@tabler/icons-react` directly (that would re-bundle the icon set per preview).
- Provider: `MantineProvider` with `theme` = `$ref` to the exported `theme` (theme.ts), `defaultColorScheme: light`.
- Playwright chromium installed to ~/Library/Caches/ms-playwright (via `.ds-sync` npx playwright install chromium).

## Previews
- Overlays (Menu, Modal, Tooltip, ...) render with `defaultOpened`/`opened` + `withinPortal={false}` and a `cardMode: single` + viewport override in config.
- `Button busy` hides the label behind the loader - expected Mantine behaviour.
- Tooltip card (360x200): a `position="right"` tooltip with a long label clips at the right edge; keep targets narrow or position top/bottom.
- The app's custom icons (`src/shared/ui/icons/icons.ts`: `IconChevronsUpDown`, `IconChevronsDownUp`) ship via `extraEntries` and sit on `window.NoesisDS` beside Tabler's.
- AppShell preview uses `mode="static"` with `h={460}` (560 overflows the 960x560 card).
- Modal preview: no `centered`, `yOffset={16}`, `transitionProps={{duration:0}}`, short content - otherwise the title clips in the 640x420 card. The close button shows its autofocus ring (expected).
- MantineProvider DarkScheme preview: a nested provider with only `forceColorScheme="dark"` stays light because the harness's outer provider owns `<html>`'s scheme attribute. The preview scopes it: `cssVariablesSelector="#noesis-dark-scope"`, `deduplicateCssVariables={false}`, `withGlobalClasses={false}`, `getRootElement` -> that element, plus a wrapper div with that id, `data-mantine-color-scheme="dark"` and `background: var(--mantine-color-body)`. Harness-only; real apps use one provider with `defaultColorScheme`.
- A missing icon name renders a silently blank cell (no error cell) - check `window.NoesisDS.Icon*` names exist before using them.
- Accordion with inline badges in the control needs `maw={600}`, or the xs badge truncates.

## Known render warns (triaged, benign)
- `[TOKENS_MISSING]` (~67 vars: `--affix-*`, `--app-shell-*`, `--mantine-text-wrap`...) - set at runtime by MantineProvider / component inline styles. Verified `--mantine-color-brand-6`, `--mantine-spacing-md`, `--mantine-radius-sm`, `--mantine-color-dimmed`, `--mantine-color-body` resolve in a rendered card.
- `[RENDER_THIN]` Modal - fixed-position overlay measures 0px; screenshot shows the full dialog.
- `[GRID_OVERFLOW]` fixed with `cardMode: column` for Grid, Group, MantineProvider, TextInput.

## Re-sync risks
- `FALLBACK_DTS` in build-pkg.mjs hand-describes Button and Menu; it silently drifts if their wrappers gain props/statics.
- `.design-sync/overrides/dts.mjs` is a fork of the converter's lib/dts.mjs - diff against the bundled copy on each re-sync.
- The build reads `tsconfig.app.json`; if it gains options incompatible with `emitDeclarationOnly`, build-pkg.mjs breaks.
- Previews mirror app compositions (shell, change picker, dev-tools modal, scenario accordion) - they don't update when those screens change.
- Mantine module augmentation (`mantine.d.ts`, the `brand` colour) isn't seen by the d.ts extractor, so `color` unions omit `"brand"`; the conventions header documents it instead.
- New wrapper modules in src/shared/design-system are picked up automatically by build-pkg.mjs; add a preview for each.
