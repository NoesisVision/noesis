import { getRouteApi, Link } from '@tanstack/react-router';
import { clsx } from 'clsx';
import { useActiveRoute } from '#/components/core/use-active-route.ts';
import { useChangeId } from '#/components/core/use-change-id.ts';
import { AppShell } from '#/components/design-system/app-shell';
import { Box } from '#/components/design-system/box';
import { NavLink } from '#/components/design-system/nav-link';
import { ScrollArea } from '#/components/design-system/scroll-area';
import { Text } from '#/components/design-system/text';
import { APP_PUBLIC_ROUTES, DESIGN_DOCS_ROUTE } from '#/routes/routes.ts';
import { ChangePicker } from './change-picker';
import classes from './sidebar.module.css';

interface SidebarProps {
  onNavigate: () => void;
}

type ChangeRouteEntry = (typeof APP_PUBLIC_ROUTES.changes)[number];

interface ChangeNavHeadingProps {
  entry: ChangeRouteEntry;
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
        {APP_PUBLIC_ROUTES.changes.map((entry) => {
          const params = { changeId: activeChange?.slug ?? '' };
          if (entry.to !== DESIGN_DOCS_ROUTE.to) {
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
        {APP_PUBLIC_ROUTES.documentation.map((entry) => (
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
