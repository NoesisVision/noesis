# Design system

This folder owns all Mantine imports, including the provider, theme, styles,
hooks, and form helpers. Shells and views import individual modules:

```tsx
import { Button } from '#/components/design-system/button';
```

Each component has its own wrapper module for future customization. The shared
`wrapComponent` helper forwards props (including React 19 refs), retains Mantine's
polymorphic signatures and public static helpers, and gives wrappers a
`DesignSystem.*` display name. Used `Menu` and `AppShell` subcomponents are wrapped
as well. Keep component-specific customization in its wrapper file and shared
theme defaults in `theme.ts`.

Oxlint rejects `@mantine/*` imports and re-exports anywhere else in the frontend.
Add new Mantine primitives here before using them in application components.
