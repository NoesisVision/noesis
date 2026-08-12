import { createFileRoute } from '@tanstack/react-router';
import { PlaceholderView } from '@/components/shell/placeholder-view';
import {
  PanelBody,
  PanelFields,
  PanelHeading,
} from '@/components/shell/right-panel';
import { useRightPanel } from '@/components/shell/use-shell';
import { useTheme } from '@/components/shell/use-theme';

export const Route = createFileRoute('/_shell/settings')({
  component: SettingsView,
  staticData: { breadcrumb: 'Settings', viewId: 'settings' },
});

export function SettingsPanel() {
  const { choice } = useTheme();

  return (
    <>
      <PanelHeading>About</PanelHeading>
      <PanelBody>
        <PanelFields
          fields={{
            Frontend: 'React 19 + Vite',
            Backend: 'Hono on Bun',
            Theme: choice ?? 'system',
          }}
        />
      </PanelBody>
    </>
  );
}

export function SettingsView() {
  useRightPanel(SettingsPanel);

  return (
    <PlaceholderView
      title="Settings"
      description="Placeholder view. Settings forms are a separate feature."
    />
  );
}
