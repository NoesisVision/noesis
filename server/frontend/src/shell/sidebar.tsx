import { getRouteApi, Link } from '@tanstack/react-router';
import { clsx } from 'clsx';
import { useChangeId } from '#/features/changes/current-change.ts';
import { ChangePicker } from '#/features/changes/ui/change-picker.tsx';
import { AppShell } from '#/shared/design-system/app-shell';
import { Box } from '#/shared/design-system/box';
import { NavLink } from '#/shared/design-system/nav-link';
import { ScrollArea } from '#/shared/design-system/scroll-area';
import { Text } from '#/shared/design-system/text';
import {
  APP_PUBLIC_NAV,
  DESIGN_DOCS_NAV,
  type NavItem,
} from '#/shell/navigation/nav-items.ts';
import { useActiveRoute } from '#/shell/navigation/use-active-route.ts';
import classes from './sidebar.module.css';

interface SidebarProps {
  onNavigate: () => void;
}

interface ChangeNavHeadingProps {
  entry: NavItem;
  params: { changeId: string };
  /** No change is open, or the group this heading owns is empty. */
  disabled: boolean;
  onNavigate: () => void;
}

/** The top-level link of a change view, with its own group's items beneath it. */
function ChangeNavHeading({
  entry,
  params,
  disabled,
  onNavigate,
}: ChangeNavHeadingProps) {
  // Active by leaf route id, not by pathname: `matchRoute` reports the change
  // layout as matching under every view beneath it, so Overview would stay
  // lit. The Link is told the same (`exact`), because Mantine's NavLink also
  // styles the `aria-current` the Link sets on a fuzzy match.
  const { isActive } = useActiveRoute();

  return (
    <NavLink
      label={entry.label}
      leftSection={<entry.icon size={22} stroke={1.6} />}
      disabled={disabled}
      active={isActive(
        entry.routeId,
        'exact' in entry ? entry.exact : undefined,
      )}
      onClick={onNavigate}
      renderRoot={(props) => (
        <Link
          {...props}
          className={classes.link}
          to={entry.to}
          params={params}
          activeOptions={{ exact: true }}
        />
      )}
    />
  );
}

/** Change navigation and child groups for the current or last opened change. */
const routeApi = getRouteApi('/_shell');

export function Sidebar({ onNavigate }: SidebarProps) {
  const changes = routeApi.useLoaderData();
  const { isActive } = useActiveRoute();
  const { changeId } = useChangeId();

  const activeChange =
    changes.find((c) => c.slug === changeId) ?? changes[0] ?? null;

  return (
    <>
      <AppShell.Section px="xs" pt="md" pb="md">
        <ChangePicker
          changes={changes}
          current={activeChange}
          onNavigate={onNavigate}
        />
      </AppShell.Section>
      <AppShell.Section grow component={ScrollArea} px="xs">
        {APP_PUBLIC_NAV.changes.map((entry) => {
          const params = { changeId: activeChange?.slug ?? '' };
          if (entry.to !== DESIGN_DOCS_NAV.to) {
            return (
              <ChangeNavHeading
                key={entry.to}
                entry={entry}
                params={params}
                disabled={activeChange === null}
                onNavigate={onNavigate}
              />
            );
          }

          const items = activeChange?.designDocs ?? [];

          return (
            // A labelled ARIA group: none of the tags the lint rule suggests
            // describes navigation.
            // oxlint-disable-next-line jsx-a11y/prefer-tag-over-role
            <Box key={entry.to} role="group" aria-label={entry.label}>
              <ChangeNavHeading
                entry={entry}
                params={params}
                disabled={activeChange === null || items.length === 0}
                onNavigate={onNavigate}
              />
              {!!items.length && (
                <Box className={classes.subGroup}>
                  {items.map((item) => (
                    <NavLink
                      key={item.id}
                      label={item.name}
                      onClick={onNavigate}
                      renderRoot={(props) => (
                        <Link
                          {...props}
                          className={clsx(classes.link, classes.subLink)}
                          to="/changes/$changeId/design-docs/$docId"
                          params={{ ...params, docId: item.id }}
                          activeOptions={{ exact: true }}
                        />
                      )}
                    />
                  ))}
                </Box>
              )}
            </Box>
          );
        })}
      </AppShell.Section>
      <AppShell.Section
        px="xs"
        py="sm"
        style={{
          borderTop: '1px solid var(--mantine-color-default-border)',
        }}
      >
        <Box px="sm" pb={4}>
          <Text size="xs" fw={600} c="dimmed" tt="uppercase">
            Documentation
          </Text>
        </Box>
        {APP_PUBLIC_NAV.documentation.map((entry) => (
          <NavLink
            key={entry.to}
            label={entry.label}
            leftSection={<entry.icon size={18} stroke={1.6} />}
            active={isActive(entry.routeId)}
            onClick={onNavigate}
            renderRoot={(props) => (
              <Link
                {...props}
                className={classes.link}
                to={entry.to}
                activeOptions={{ exact: true }}
              />
            )}
          />
        ))}
      </AppShell.Section>
    </>
  );
}
