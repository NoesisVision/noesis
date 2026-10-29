import { IconMinimize } from '@tabler/icons-react';
import { createContext, use } from 'react';
import { UnstyledButton } from '#/shared/design-system/unstyled-button.tsx';
import classes from './shell-fullscreen.module.css';

interface ShellFullscreen {
  /** Whether the shell's content is what the browser shows full screen. */
  fullscreen: boolean;
  toggle: () => void;
}

/**
 * Full screen is one for the whole app: the shell's content goes full screen,
 * not the view in it, so moving between views keeps it. The shell provides
 * it; outside one, there is nothing to put full screen.
 */
export const ShellFullscreenContext = createContext<ShellFullscreen>({
  fullscreen: false,
  toggle: () => {},
});

/**
 * The way back out of full screen, where the top bar that holds the toggle is
 * not painted: a pill in the content's bottom right corner, only while it is
 * full screen.
 */
export function ExitFullscreenButton() {
  const { fullscreen, toggle } = use(ShellFullscreenContext);
  if (!fullscreen) return null;
  return (
    <UnstyledButton className={classes.exit} onClick={toggle}>
      <IconMinimize size={16} stroke={1.8} aria-hidden />
      Exit full screen
    </UnstyledButton>
  );
}
