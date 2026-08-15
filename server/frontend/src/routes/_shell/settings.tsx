import { createFileRoute } from '@tanstack/react-router';
import { ExternalLinkIcon, PuzzleIcon } from 'lucide-react';
import { MembersSection } from '@/components/shell/members-section';
import { PlaceholderView } from '@/components/shell/placeholder-view';
import {
  PanelBody,
  PanelFields,
  PanelHeading,
} from '@/components/shell/right-panel';
import { useRightPanel, useShell } from '@/components/shell/use-shell';
import { useTheme } from '@/components/shell/use-theme';
import { Button } from '@/components/ui/button';
import { INSTALL_HREF } from '@/lib/auth';

export interface SettingsSearch {
  /** Set by `/auth/install/callback`: `connected`, `requested` or `error`. */
  install?: string;
  reason?: string;
}

export const Route = createFileRoute('/_shell/settings')({
  validateSearch: (search: Record<string, unknown>): SettingsSearch => ({
    install: typeof search.install === 'string' ? search.install : undefined,
    reason: typeof search.reason === 'string' ? search.reason : undefined,
  }),
  component: SettingsView,
  staticData: { breadcrumb: 'Settings', viewId: 'settings' },
});

export function SettingsPanel() {
  const { choice } = useTheme();
  const { account, installations } = useShell();

  return (
    <>
      <PanelHeading>About</PanelHeading>
      <PanelBody>
        <PanelFields
          fields={{
            Frontend: 'React 19 + Vite',
            Backend: 'Hono on Bun',
            Theme: choice ?? 'system',
            'Signed in': `@${account.login}`,
            Role: account.role,
            Installations: String(installations.length),
          }}
        />
      </PanelBody>
    </>
  );
}

const INSTALL_MESSAGES: Record<string, string> = {
  connected: 'Repository access connected.',
  requested:
    'The install was requested. An organisation admin has to approve it before those repositories appear here.',
  not_visible:
    'That installation is not visible to your account. Ask whoever installed the App to grant you access.',
  install_failed: 'Connecting the installation failed. Try again.',
};

function InstallationsSection() {
  const { installations } = useShell();
  const { install, reason } = Route.useSearch();
  const message =
    install === 'error'
      ? (INSTALL_MESSAGES[reason ?? ''] ??
        'Connecting the installation failed.')
      : install === undefined
        ? undefined
        : INSTALL_MESSAGES[install];

  return (
    <section className="flex max-w-2xl flex-col gap-3">
      <div className="flex flex-col gap-1">
        <h2 className="text-sm font-medium">Repository access</h2>
        <p className="text-sm text-muted-foreground">
          Which repositories Noesis may read is decided on GitHub's install
          screen, by whoever administers the account. Noesis can only pick from
          what has been granted there.
        </p>
      </div>

      {message !== undefined && (
        <p className="rounded-lg border bg-card p-3 text-sm text-card-foreground shadow-xs">
          {message}
        </p>
      )}

      {installations.length === 0 ? (
        <p className="rounded-lg border bg-card p-3 text-sm text-muted-foreground shadow-xs">
          No repositories connected yet.
        </p>
      ) : (
        <ul className="flex flex-col gap-1">
          {installations.map((installation) => (
            <li
              key={installation.id}
              className="flex items-center gap-3 rounded-lg border bg-card px-3 py-2 text-card-foreground shadow-xs"
            >
              <span className="flex flex-col gap-0.5">
                <span className="text-sm font-medium">
                  {installation.accountLogin}
                </span>
                <span className="text-xs text-muted-foreground">
                  {installation.accountType} ·{' '}
                  {installation.repositorySelection === 'all'
                    ? 'all repositories'
                    : 'selected repositories'}
                </span>
              </span>
              {/* The only move available to us: deep-link to the screen that
                  actually decides the grant. */}
              <Button
                variant="ghost"
                size="sm"
                className="ml-auto"
                render={
                  <a
                    href={installation.manageUrl}
                    target="_blank"
                    rel="noreferrer"
                  >
                    <span>Manage on GitHub</span>
                    <ExternalLinkIcon />
                  </a>
                }
              />
            </li>
          ))}
        </ul>
      )}

      <div>
        <Button
          variant="outline"
          render={
            <a href={INSTALL_HREF}>
              <PuzzleIcon />
              <span>
                {installations.length === 0
                  ? 'Connect repositories'
                  : 'Connect another account'}
              </span>
            </a>
          }
        />
      </div>
    </section>
  );
}

export function SettingsView() {
  const { account } = useShell();
  useRightPanel(SettingsPanel);

  return (
    <PlaceholderView
      title="Settings"
      description="Repository access and membership. The rest of the settings forms are a separate feature."
    >
      <InstallationsSection />
      {/* `role` is load-bearing in exactly one place. */}
      {account.role === 'owner' && <MembersSection />}
    </PlaceholderView>
  );
}
