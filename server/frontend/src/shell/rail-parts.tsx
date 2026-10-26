import { Link, useSearch } from '@tanstack/react-router';
import type { ComponentProps } from 'react';
import {
  DESIGN_DOC_VIEW_ICONS,
  DESIGN_DOC_VIEWS,
  DESIGN_DOCS_TONE,
  DesignDocsIcon,
  readingView,
} from '#/features/design-docs/design-docs.model.ts';
import { Box } from '#/shared/design-system/box';
import { NavLink } from '#/shared/design-system/nav-link';
import { ThemeIcon } from '#/shared/design-system/theme-icon';
import { titleCase } from '#/shared/ui/title-case.ts';
import {
  ACTIVE_OPTIONS,
  APP_PUBLIC_NAV,
} from '#/shell/navigation/nav-items.ts';
import type { ChangeNavChild } from '#/shell/navigation/use-change-nav.ts';
import classes from './rail.module.css';

/** A design doc's tile: filled in its colour while the doc is open. */
export function DesignDocTile({ open }: { open: boolean }) {
  return (
    <ThemeIcon
      size={22}
      radius={7}
      variant={open ? 'filled' : 'light'}
      color={DESIGN_DOCS_TONE}
      className={classes.tile}
      aria-hidden
    >
      <DesignDocsIcon size={14} stroke={1.7} />
    </ThemeIcon>
  );
}

interface DesignDocViewsProps {
  item: ChangeNavChild;
  onNavigate: (() => void) | undefined;
}

/**
 * The ways a design doc is read, hanging off a line under its tile, each a
 * link. Only the open doc has a view being read; it links to the address as
 * it stands, so it alone matches it, and the others keep every view's place
 * and switch only the view.
 */
export function DesignDocViews({ item, onNavigate }: DesignDocViewsProps) {
  const search =
    useSearch({
      from: '/_shell/changes/$changeId/design-docs/$docId',
      shouldThrow: false,
    }) ?? {};
  const current = item.open ? readingView(search) : undefined;
  const place = item.open ? search : {};

  return (
    <Box className={classes.views} data-page-tone={DESIGN_DOCS_TONE}>
      {DESIGN_DOC_VIEWS.map((view) => {
        const Icon = DESIGN_DOC_VIEW_ICONS[view];
        return (
          <NavLink
            key={view}
            className={classes.view}
            label={titleCase(view)}
            leftSection={<Icon size={15} stroke={1.7} />}
            onClick={onNavigate}
            renderRoot={(props) => (
              <Link
                {...props}
                to={item.link.to}
                params={item.link.params}
                search={view === current ? place : { ...place, view }}
                activeOptions={{ exact: true, includeSearch: true }}
                viewTransition
              />
            )}
          />
        );
      })}
    </Box>
  );
}

/**
 * What makes an app-level row a link: the route it opens, or — while the
 * entry is not open yet — nothing to follow, so it stays named but inert.
 */
export function appLinkTo(
  entry: (typeof APP_PUBLIC_NAV.documentation)[number],
  onNavigate: (() => void) | undefined,
): Partial<ComponentProps<typeof NavLink>> {
  if ('disabled' in entry && entry.disabled)
    return { disabled: true, 'aria-disabled': true };
  return {
    onClick: onNavigate,
    renderRoot: (props: Record<string, unknown>) => (
      <Link
        {...props}
        to={entry.to}
        activeOptions={ACTIVE_OPTIONS}
        viewTransition
      />
    ),
  };
}
