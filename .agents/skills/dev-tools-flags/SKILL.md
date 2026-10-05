---
name: dev-tools-flags
description: Add, read, flip or remove an internal experiment flag in the Noesis SPA (server/frontend) — a per-user switch on the Dev Tools page, carried by DevToolsContext and read with useDevToolsContext. Use whenever a frontend change should be tried behind a toggle, compared old-versus-new, hidden until it is ready, or when the user says flag, feature flag, toggle, experiment, A/B, "behind a switch", "let me try both", or asks to make a flagged behaviour the default or drop a flag.
---

# Dev tools flags

An experiment flag is a boolean that lets one person try a change in their own
browser before it is everyone's behaviour. It is internal: it is stored in that
user's `localStorage` (`noesis.dev-tools.features`), so switching it changes
nothing for anyone else, and it is never a product setting or a permission.

Paths are relative to `server/frontend/src`.

## The one rule: set on the Dev Tools page, read everywhere else

- **Everywhere reads** through `useDevToolsContext()`, which returns only
  `{ enabled, features }`, both read-only:

  ```tsx
  const {
    features: { compactOutline },
  } = useDevToolsContext();
  ```

- **Only `features/dev-tools/ui/dev-tools-view.tsx` writes**, with
  `useSetDevToolsFeatures()`. It is the one place a user switches flags, and it
  already renders a `Switch` for every flag in the schema. Oxlint rejects that
  import in any other file; do not add an override, a disable comment, or a
  second way to reach the setter (a prop, a callback, a re-export).

The reason: a flag the app can flip on its own stops being the user's
experiment — they can no longer tell which behaviour they are looking at, or
switch back. One writer keeps the state explainable.

## Adding a flag

All of it is in `shared/dev-tools/dev-tools-context.tsx`:

1. Add the key to `featuresSchema` with its default:
   `compactOutline: z.boolean().default(false)`. `.default` matters: without
   it, a user's stored flags fail the schema the day a second flag is added,
   and every switch they set is reset.
2. While the schema has keys, `Features` is `z.infer<typeof featuresSchema>`
   (replace the `Record<string, boolean>` placeholder and its comment), so a
   misspelled flag is a type error at the read site.
3. Put the same default in `INIT_VALUE.features`. Default to `false` — the
   experiment is off until the user turns it on — unless the user asks
   otherwise.

Name the flag for the behaviour it turns on, in camelCase, in the domain's
words (`compactOutline`, `showV2Tree`): the Dev Tools page shows it as
`featureLabel(name)` — `Compact Outline` — so the name is the only
explanation the user gets. Nothing per flag goes into `dev-tools-view.tsx`;
it lists the schema's keys itself.

## Reading a flag

Read it at the component that owns the behaviour, or as high as the branch
point, and pass a plain prop down to anything shared (`shared/ui/`) rather
than having shared components reach into dev tools. Keep the branch small and
visible — one `if`/ternary choosing old or new — so removing it later is a
deletion, not a refactor.

## Ending an experiment

A flag is temporary. When the user decides:

- **Keep the new behaviour**: delete the old branch and the read.
- **Drop it**: delete the new branch and the read.
- Either way, remove the key from `featuresSchema` and `INIT_VALUE.features`.
  When the last key goes, restore `type Features = Record<string, boolean>`
  and the comment above the empty schema. Stored values for the old key are
  dropped by the schema on the next load — nothing to migrate.

"Make it the default" while still experimenting means flipping the default in
both places to `true`, nothing more.

## Checking it

- `bun run ci` — types catch a read of a flag that does not exist.
- `bun run lint` passes — it is what keeps the setter inside the Dev Tools view.
- The flag appears on `/dev-tools` under its label (dev tools are enabled with
  `devtool()` in the browser console).
