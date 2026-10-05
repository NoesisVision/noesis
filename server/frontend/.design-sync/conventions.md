# Noesis design system — how to build with it

Noesis wraps **Mantine 9**. Every component on `window.NoesisDS` is the app's own wrapper around the Mantine component of the same name, with the same props (some ship defaults — e.g. `Card` is `withBorder`, `shadow="sm"`, `radius="md"`; `Tooltip` has an arrow and a quick pop transition). If you know Mantine, you know this API; use only the components listed in this README.

## Setup — always wrap in `MantineProvider` with the theme

Components read colours, fonts, spacing and radius from Mantine's theme context. Without the provider they render unstyled or throw. Pass the exported `theme` (the noesis.vision palette):

```jsx
const { MantineProvider, theme, cssVariablesResolver } = window.NoesisDS;

<MantineProvider theme={theme} cssVariablesResolver={cssVariablesResolver} defaultColorScheme="light">
  <App />
</MantineProvider>
```

`styles.css` (Mantine's stylesheet + the Raleway font) must be loaded. `defaultColorScheme="dark"` switches every component to dark mode. `cssVariablesResolver` defines the app's own `--noesis-*` CSS variables (below); without it they don't resolve.

## Styling idiom — props, not classes

There are no utility classes. Style with Mantine **style props** and component props, which resolve against the theme:

| Concern | Props / values |
|---|---|
| Spacing | `m`, `mt`, `mb`, `mx`, `my`, `p`, `px`, `py` and `gap` — `"xs" \| "sm" \| "md" \| "lg" \| "xl"` or a number |
| Size | `w`, `h`, `maw`, `miw`, `mih` |
| Colour | `c` (text), `bg` — theme keys like `"brand.6"`, `"gray.0"`, `"dimmed"`, `"red"` |
| Type | `fw`, `fz`, `ta`, `tt`, `lh`; `Text size="xs".."xl"`; `Title order={1..6}` |
| Component look | `variant` (`filled`, `light`, `outline`, `subtle`, `default`), `color`, `size`, `radius` |

The primary colour is **`brand`** (blue, shades 0–9; shade 7 in light, 6 in dark) and is the default for every `color` prop — write `color="brand"` only when you mean it explicitly. Use `color="red"` for destructive actions, `c="dimmed"` for secondary text. Defaults: `radius="sm"`, font `Raleway Variable`, headings weight 600. In raw CSS, use the theme variables: `var(--mantine-color-brand-6)`, `var(--mantine-spacing-md)`, `var(--mantine-radius-sm)`, `var(--mantine-color-dimmed)`, `var(--mantine-color-body)`. The app adds a few of its own: `var(--noesis-secondary-text)` (secondary text, a step stronger than dimmed) and `var(--noesis-focus-ring)` (the `:focus-visible` outline, e.g. `outline: var(--noesis-focus-ring); outline-offset: 2px`).

Lay out with `Stack` (vertical), `Group` (horizontal, `justify`, `wrap`), `Grid`/`Grid.Col` (`span`), `Center`; contain content with `Card` (+ `Card.Section`). Don't hand-write flex divs when one of these fits.

## Icons

All of Tabler (`@tabler/icons-react`) is on the same global: `const { IconPlus, IconTrash } = window.NoesisDS;`. The app's own `IconChevronsUpDown` (expand all) and `IconChevronsDownUp` (collapse all) are there too, drawn on the same grid. Size icons explicitly — 16 inside buttons, menu items and sections, 18–20 in `ActionIcon` and `ThemeIcon`. Put icons in `leftSection`/`rightSection` rather than inside `children`.

## App-specific API

- `Button` adds **`busy`**: shows the loader and disables the button while an action runs (prefer it over `loading` + `disabled`).
- Icon-only controls are `ActionIcon` with an `aria-label`; dropdowns are `Menu` > `Menu.Target` + `Menu.Dropdown` > `Menu.Label` / `Menu.Item` / `Menu.Divider`.

## Where the truth lives

Before styling, read `styles.css` and the `_ds_bundle.css` it imports (Mantine's real stylesheet). Each component's `<Name>.d.ts` is its prop contract, and `<Name>.prompt.md` has worked examples.

## Example

```jsx
const { MantineProvider, theme, cssVariablesResolver, Card, Stack, Group, Title, Text, Badge, Button, IconPlus } = window.NoesisDS;

<MantineProvider theme={theme} cssVariablesResolver={cssVariablesResolver}>
  <Stack gap="md" p="lg" maw={520}>
    <Group justify="space-between">
      <Title order={2}>Changes</Title>
      <Button leftSection={<IconPlus size={16} />}>New change</Button>
    </Group>
    <Card padding="md">
      <Group justify="space-between">
        <Text fw={600}>Split the order service</Text>
        <Badge variant="light">Draft</Badge>
      </Group>
      <Text size="sm" c="dimmed" mt="xs">Read and write models, so reporting stops blocking checkout.</Text>
    </Card>
  </Stack>
</MantineProvider>
```
