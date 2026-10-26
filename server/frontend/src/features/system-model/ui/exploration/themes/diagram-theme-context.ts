import { createContext, useContext } from 'react';
import type { DiagramTheme } from './diagram-theme.ts';
import { DEFAULT_THEME } from './themes.ts';

/** The theme the canvas is drawn in, for what floats over it. */
export const DiagramThemeContext = createContext<DiagramTheme>(DEFAULT_THEME);

/*
 * What a surface over the canvas carries to be drawn in its theme: a menu,
 * a popover or a tooltip is rendered at the page's end, outside the canvas
 * the theme hangs on, so it hangs the theme on itself — its root class, its
 * `data-diagram-theme` — and names itself with a `data-part`. A theme's
 * stylesheet reaches it as `.theme[data-diagram-theme][data-part='…']`.
 */
export function useThemedSurface(part: string, className?: string) {
  const theme = useContext(DiagramThemeContext);
  return {
    className:
      [className, theme.className].filter(Boolean).join(' ') || undefined,
    'data-diagram-theme': theme.id,
    'data-part': part,
  };
}
