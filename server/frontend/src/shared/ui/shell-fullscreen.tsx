import { IconMaximize, IconMinimize } from '@tabler/icons-react';
import { createContext, useContext } from 'react';
import { ActionIcon } from '#/shared/design-system/action-icon.tsx';

interface ShellFullscreen {
  /** Whether the shell's content is what the browser shows full screen. */
  fullscreen: boolean;
  toggle: () => void;
}

/**
 * Full screen is one for the whole app: the shell's content goes full screen,
 * not the view in it, so moving between views keeps it. The shell provides
 * it; outside one, the button is drawn but has nothing to put full screen.
 */
export const ShellFullscreenContext = createContext<ShellFullscreen>({
  fullscreen: false,
  toggle: () => {},
});

/** The button a view shows beside its own controls to take the shell full screen. */
export function FullscreenButton() {
  const { fullscreen, toggle } = useContext(ShellFullscreenContext);
  const label = fullscreen ? 'Exit full screen' : 'Full screen';
  return (
    <ActionIcon
      variant="default"
      size="lg"
      aria-label={label}
      title={label}
      onClick={toggle}
    >
      {fullscreen ? (
        <IconMinimize size={22} stroke={1.6} aria-hidden />
      ) : (
        <IconMaximize size={22} stroke={1.6} aria-hidden />
      )}
    </ActionIcon>
  );
}
