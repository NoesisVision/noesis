import { Link } from '@tanstack/react-router';
import { clsx } from 'clsx';
import { useChangeNavigation } from '#/features/changes/changes.api.ts';
import { ChangePicker } from '#/features/changes/ui/change-picker.tsx';
import { AppShell } from '#/shared/design-system/app-shell';
import { Box } from '#/shared/design-system/box';
import { NavLink } from '#/shared/design-system/nav-link';
import { ScrollArea } from '#/shared/design-system/scroll-area';
import { Text } from '#/shared/design-system/text';
import {
  APP_PUBLIC_NAV,
  DESIGN_DOCS_NAV,
  DOCUMENTS_NAV,
  type NavItem,
} from '#/shell/navigation/nav-items.ts';
import { useActiveRoute } from '#/shell/navigation/use-active-route.ts';
import classes from './sidebar.module.css';

interface SidebarProps {
  onNavigate: () => void;
}

/** Where a named child of a change opens, one arm per group. */
type ChangeChildLink =
  | {
      to: '/changes/$changeId/documents/$documentId';
      params: { changeId: string; documentId: string };
    }
  | {
      to: '/changes/$changeId/design-docs/$docId';
      params: { changeId: string; docId: string };
    };

interface ChangeNavChild {
  id: string;
  name: string;
  link: ChangeChildLink;
}

/** The views that name their own contents beneath them, by the view's path. */
type ChangeNavChildren = Partial<Record<NavItem['to'], ChangeNavChild[]>>;

function changeNavChildren(
  change: ReturnType<typeof useChangeNavigation>['activeChange'],
  changeId: string,
): ChangeNavChildren {
  return {
    [DOCUMENTS_NAV.to]: (change?.documents ?? []).map((item) => ({
      ...item,
      link: {
        to: '/changes/$changeId/documents/$documentId',
        params: { changeId, documentId: item.id },
      },
    })),
    [DESIGN_DOCS_NAV.to]: (change?.designDocs ?? []).map((item) => ({
      ...item,
      link: {
        to: '/changes/$changeId/design-docs/$docId',
        params: { changeId, docId: item.id },
      },
    })),
  };
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
export function Sidebar({ onNavigate }: SidebarProps) {
  const { changes, activeChange } = useChangeNavigation();
  const { isActive } = useActiveRoute();
  const params = { changeId: activeChange?.id ?? '' };
  const children = changeNavChildren(activeChange, params.changeId);

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
