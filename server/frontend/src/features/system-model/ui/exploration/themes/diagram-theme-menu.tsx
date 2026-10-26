import { IconCheck, IconPalette } from '@tabler/icons-react';
import { useState } from 'react';
import { ActionIcon } from '#/shared/design-system/action-icon.tsx';
import { useLocalStorage } from '#/shared/design-system/hooks.ts';
import { Menu } from '#/shared/design-system/menu.tsx';
import { Tooltip } from '#/shared/design-system/tooltip.tsx';
import { VisuallyHidden } from '#/shared/design-system/visually-hidden.tsx';
import type { DiagramTheme } from './diagram-theme.ts';
import { DEFAULT_THEME, type DiagramThemeId, THEMES } from './themes.ts';

/*
 * The theme the exploration's diagram is drawn in (themes.ts): the
 * reader's own, kept on the machine for every diagram, the first of the
 * list until they change it.
 */
export function useDiagramTheme() {
  const [id, setId] = useLocalStorage<DiagramThemeId>({
    key: 'noesis.systemModel.exploration.theme',
    defaultValue: DEFAULT_THEME.id,
    getInitialValueInEffect: false,
    // Anything else kept under the key, from before or by hand, is the first.
    deserialize: (stored) =>
      THEMES.find((theme) => stored === JSON.stringify(theme.id))?.id ??
      DEFAULT_THEME.id,
  });
  const theme: DiagramTheme =
    THEMES.find((each) => each.id === id) ?? DEFAULT_THEME;
  return [theme, setId] as const;
}

/** Beside the zoom: a quiet button opening onto the diagram's themes, the one in use ticked. */
export function DiagramThemeMenu({
  theme,
  onTheme,
}: {
  /** The id of the theme in use. */
  theme: string;
  onTheme: (theme: DiagramThemeId) => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <Menu
      opened={open}
      onChange={setOpen}
      position="bottom-end"
      shadow="md"
      // The canvas stops a mouse press from reaching the page; a pointer's does.
      clickOutsideEvents={['pointerdown']}
    >
      <Menu.Target>
        <Tooltip label="Diagram theme" disabled={open}>
          <ActionIcon
            variant="subtle"
            color="gray"
            size="lg"
            aria-label="Diagram theme"
          >
            <IconPalette size={18} stroke={1.6} aria-hidden />
          </ActionIcon>
        </Tooltip>
      </Menu.Target>
      <Menu.Dropdown>
        <Menu.Label>Diagram theme</Menu.Label>
        {THEMES.map(({ id, label }) => (
          <Menu.Item
            key={id}
            leftSection={
              <IconCheck
                size={14}
                stroke={1.8}
                aria-hidden
                visibility={theme === id ? 'visible' : 'hidden'}
              />
            }
            onClick={() => onTheme(id)}
          >
            {label}
            {/* Mantine makes each a plain menu item, never a radio: the
                tick says which is in use to the eye, this to the ear. */}
            {theme === id && <VisuallyHidden>, in use</VisuallyHidden>}
          </Menu.Item>
        ))}
      </Menu.Dropdown>
    </Menu>
  );
}
