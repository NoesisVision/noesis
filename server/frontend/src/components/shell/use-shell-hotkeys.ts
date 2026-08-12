import * as React from 'react';
import { useShell } from '@/components/shell/use-shell';

// Cmd/Ctrl+B is owned by SidebarProvider; this hook covers the rest of the
// shell: the palette and the right panel.
export function useShellHotkeys(): void {
  const { togglePalette, toggleRightPanel } = useShell();

  React.useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (!event.metaKey && !event.ctrlKey) return;
      if (event.key === 'k' || event.key === 'K') {
        event.preventDefault();
        togglePalette();
      } else if (event.key === '.') {
        event.preventDefault();
        toggleRightPanel();
      }
    }

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [togglePalette, toggleRightPanel]);
}
