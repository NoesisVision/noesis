import { Link } from '@tanstack/react-router';
import { clsx } from 'clsx';
import { AppShell } from '#/shared/design-system/app-shell';
import { Box } from '#/shared/design-system/box';
import { NavLink } from '#/shared/design-system/nav-link';
import { ScrollArea } from '#/shared/design-system/scroll-area';
import { Text } from '#/shared/design-system/text';
import {
  ACTIVE_OPTIONS,
  APP_PUBLIC_NAV,
  type NavItem,
} from '#/shell/navigation/nav-items.ts';
import { useChangeNav } from '#/shell/navigation/use-change-nav.ts';
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
  return (
    <NavLink
      label={entry.label}
      leftSection={<entry.icon size={22} stroke={1.6} />}
      disabled={disabled}
      onClick={onNavigate}
      renderRoot={(props) => (
        <Link
          {...props}
          className={classes.link}
          to={entry.to}
          params={params}
          activeOptions={ACTIVE_OPTIONS}
        />
      )}
    />
  );
}

/**
 * The navigation as a list, for a screen too narrow for the header's bar:
 * change views with their child groups, then documentation. The change
 * picker and dev tools stay in the header.
 */
export function Sidebar({ onNavigate }: SidebarProps) {
  const { activeChange, params, children } = useChangeNav();
  return (
    <>
      <AppShell.Section grow component={ScrollArea} px="xs" pt="md">
        {APP_PUBLIC_NAV.changes.map((entry) => {
          const items = children[entry.to];
          if (!items) {
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

          return (
            <Box
              key={entry.to}
              // A labelled ARIA group: none of the tags the lint rule suggests
              // describes navigation.
              // oxlint-disable-next-line jsx-a11y/prefer-tag-over-role
              role="group"
              aria-label={entry.label}
              className={classes.navGroup}
            >
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
                          {...item.link}
                          className={clsx(classes.link, classes.subLink)}
                          activeOptions={ACTIVE_OPTIONS}
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
            onClick={onNavigate}
            renderRoot={(props) => (
              <Link
                {...props}
                className={classes.link}
                to={entry.to}
                activeOptions={ACTIVE_OPTIONS}
              />
            )}
          />
        ))}
      </AppShell.Section>
    </>
  );
}
