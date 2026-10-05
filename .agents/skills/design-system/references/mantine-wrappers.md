# Mantine and its wrappers

## Reach for Mantine first

Before writing a `<div>` with a class, a CSS module or a hand-rolled control,
look for the Mantine component that already does it — layout (`Stack`, `Group`,
`Grid`, `Center`), text (`Text`, `Title`, `Highlight`), surfaces (`Card`,
`Alert`, `Paper`), controls, overlays. Mantine brings the theme, both colour
schemes, focus styles and ARIA with it; a custom element has to earn each of
those by hand and usually misses one. The `mcp__mantine__*` tools search the
docs and list a component's props.

Style with props that resolve against the theme (`gap="sm"`, `c="dimmed"`,
`variant="light"`), not literal values. A CSS module is for what props cannot
express — a `:focus-visible` outline, a hover — and it reads Mantine CSS
variables (`var(--mantine-color-…)`), never hex.

## Every Mantine primitive goes through a wrapper

`@mantine/*` may only be imported inside `src/shared/design-system/`; Oxlint
rejects it anywhere else. If the component you need has no wrapper yet, add
one — one module per component, named after it in kebab case:

```tsx
// src/shared/design-system/paper.tsx
import { Paper as MantineComponent, type PaperProps } from '@mantine/core';
import { wrapComponent } from './wrap-component';

export const Paper = wrapComponent<typeof MantineComponent, PaperProps>(
  MantineComponent,
  'Paper',
  { radius: 'md' }, // optional defaults; a prop at the call site replaces them
);
```

- **Plain wrapper**: `wrapComponent(MantineX, 'X')` (see `stack.tsx`). Pass
  the props interface whenever you pass defaults (see `card.tsx`).
- **Compound component**: wrap each sub-component you use and attach it with
  `Object.assign` (see `menu.tsx`). Wrap only what is used.
- **Behaviour on top of Mantine** (a new prop): `createPolymorphicWrapper`, as
  `button.tsx` does for `busy`. A changed Button or Menu API also needs
  `FALLBACK_DTS` in `.design-sync/build-pkg.mjs` updated.
- Defaults shared by every component belong in `theme.ts`, not a wrapper.

App code imports the wrapper: `import { Paper } from
'#/shared/design-system/paper.tsx'`.

## A preview for every new module

Each new design-system module gets a preview in
`.design-sync/previews/<ExportName>.tsx`, modelled on the existing ones
(overlays use `defaultOpened`/`opened` and `withinPortal={false}`; see
`.design-sync/NOTES.md`). `build-pkg.mjs` picks the module up on its own; the
preview is what the design tool shows.
