import { useSuspenseQuery } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { changesList } from '#/api/changes';
import { useActiveRoute } from '#/components/core/useActiveRoute.ts';
import { useChangeId } from '#/components/core/useChangeId.ts';
import { AppShell } from '#/components/design-system/app-shell';
import { Box } from '#/components/design-system/box';
import { NavLink } from '#/components/design-system/nav-link';
import { ScrollArea } from '#/components/design-system/scroll-area';
import { Text } from '#/components/design-system/text';
import { SIDEBAR_ROUTES } from '#/components/shell/sidebar.routes.ts';
import { ChangePicker } from './change-picker';
import classes from './sidebar.module.css';

interface SidebarProps {
  onNavigate: () => void;
}

/**
 * Off a change route the active change falls back to the last opened, else the
 * first, so the change entries still work from `/wiki`.
 */
export function Sidebar({ onNavigate }: SidebarProps) {
  const { data: changes } = useSuspenseQuery(changesList);
  // Active by leaf route id, not by pathname: `matchRoute` reports the change
  // layout as matching under every view beneath it, so Overview would stay
  // lit. The Link is told the same (`exact`), because Mantine's NavLink also
  // styles the `aria-current` the Link sets on a fuzzy match.

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
        {SIDEBAR_ROUTES.changes.map((entry) => {
          const params = { changeId: activeChange?.slug ?? '' };
          return (
            <NavLink
              key={entry.to}
              label={entry.label}
              leftSection={<entry.icon size={22} stroke={1.6} />}
              disabled={activeChange === null}
              active={isActive(entry.routeId)}
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
        {SIDEBAR_ROUTES.documentation.map((entry) => (
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
