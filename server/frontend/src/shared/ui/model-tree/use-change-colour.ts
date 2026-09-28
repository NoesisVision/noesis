import { useMantineTheme } from '#/shared/design-system/hooks.ts';
import type { OutlineChange } from './model-outline.ts';
import { CHANGE_COLOUR } from './outline-change.ts';

/**
 * The colours Mantine gives a `light` badge in a change's colour — its text,
 * fill and border — so anything shown beside a `ChangeBadge` can match it
 * exactly. `null` for an element the design leaves alone.
 */
export function useChangeColour() {
  const theme = useMantineTheme();

  return (change: OutlineChange) => {
    const colour = CHANGE_COLOUR[change];
    if (colour === null) return null;
    return theme.variantColorResolver({
      color: colour,
      theme,
      variant: 'light',
    });
  };
}
