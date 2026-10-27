import { useLocalStorage } from '#/shared/design-system/hooks.ts';
import type { DiagramTheme } from './diagram-theme.ts';
import { DEFAULT_THEME, type DiagramThemeId, THEMES } from './themes.ts';

/*
 * The theme the exploration's diagram is drawn in (themes.ts): the
 * reader's own, kept on the machine for every diagram, the first of the
 * list until they change it — on the Dev Tools page, the one place it is
 * chosen, as an experiment flag is switched there alone.
 */
const KEY = 'noesis.systemModel.exploration.theme';

/** The theme's id as kept, and the way to choose another: the Dev Tools page's alone. */
export function useDiagramThemeChoice() {
  return useLocalStorage<DiagramThemeId>({
    key: KEY,
    defaultValue: DEFAULT_THEME.id,
    getInitialValueInEffect: false,
    // Anything else kept under the key, from before or by hand, is the first.
    deserialize: (stored) =>
      THEMES.find((theme) => stored === JSON.stringify(theme.id))?.id ??
      DEFAULT_THEME.id,
  });
}

/** The theme to draw the diagram in, as chosen; read only. */
export function useDiagramTheme(): DiagramTheme {
  const [id] = useDiagramThemeChoice();
  return THEMES.find((each) => each.id === id) ?? DEFAULT_THEME;
}
