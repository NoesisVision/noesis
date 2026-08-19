import { Link, useMatches } from '@tanstack/react-router';
import {
  BellIcon,
  MoonIcon,
  PanelRightIcon,
  SearchIcon,
  SunIcon,
} from 'lucide-react';
import * as React from 'react';
import { useShell } from '@/components/shell/use-shell';
import { useTheme } from '@/components/shell/use-theme';
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb';
import { Button } from '@/components/ui/button';
import {
  Popover,
  PopoverContent,
  PopoverDescription,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Separator } from '@/components/ui/separator';
import { SidebarTrigger, useSidebar } from '@/components/ui/sidebar';
import { useIsMobile } from '@/hooks/use-mobile';
import { cn } from '@/lib/utils';

// The brand mark, not the project: the project lives in the sidebar header,
// where the selector already carries its name and switcher. Repeating it up
// here would put the two identities side by side and leave neither reading as
// the primary one.
//
// The lockup occupies a column exactly as wide as the sidebar underneath it,
// border and all, so the two form one continuous edge down the left of the
// shell. It tracks the sidebar's collapse on the same 200ms linear curve;
// widths come from the provider's own --sidebar-width variables rather than
// being restated here.
function BrandMark() {
  const { state, isMobile } = useSidebar();
  // Off-canvas on mobile: there is no sidebar column to line up with, so the
  // lockup takes only the width it needs.
  const collapsed = !isMobile && state === 'collapsed';

  return (
    <div
      className={cn(
        'flex h-full shrink-0 items-center border-r transition-[width] duration-200 ease-linear',
        isMobile && 'w-auto px-4',
        !isMobile &&
          (collapsed
            ? 'w-(--sidebar-width-icon) justify-center'
            : 'w-(--sidebar-width) px-4'),
      )}
    >
      <Link
        to="/"
        aria-label="Noesis Vision home"
        className="flex items-center gap-2 transition-opacity hover:opacity-80"
      >
        <img
          src="/noesis-mark.webp"
          // The adjacent wordmark names the link when it is visible, and the
          // aria-label covers the cases where it is not.
          alt=""
          width={24}
          height={24}
          className="size-6 shrink-0"
        />
        {!collapsed && (
          <span className="hidden truncate text-sm font-bold sm:inline">
            Noesis Vision
          </span>
        )}
      </Link>
    </div>
  );
}

function ShellBreadcrumbs() {
  const matches = useMatches();
  // Routes carry their own label in staticData, so adding a view never means
  // touching a central breadcrumb map.
  const crumbs = matches
    .map((match) => match.staticData.breadcrumb)
    .filter((crumb): crumb is string => Boolean(crumb));

  return (
    <Breadcrumb>
      <BreadcrumbList>
        {crumbs.map((crumb, index) => (
          <React.Fragment key={crumb}>
            {index > 0 && <BreadcrumbSeparator />}
            <BreadcrumbItem>
              {index === crumbs.length - 1 ? (
                <BreadcrumbPage>{crumb}</BreadcrumbPage>
              ) : (
                <span className="truncate text-muted-foreground">{crumb}</span>
              )}
            </BreadcrumbItem>
          </React.Fragment>
        ))}
      </BreadcrumbList>
    </Breadcrumb>
  );
}

function NotificationsBell() {
  return (
    <Popover>
      <PopoverTrigger
        render={
          <Button variant="ghost" size="icon" aria-label="Notifications">
            <BellIcon />
          </Button>
        }
      />
      <PopoverContent align="end" className="w-72">
        <PopoverHeader>
          <PopoverTitle>Notifications</PopoverTitle>
          <PopoverDescription>
            Nothing to report. Scan results and collaboration events will show
            up here.
          </PopoverDescription>
        </PopoverHeader>
      </PopoverContent>
    </Popover>
  );
}

export function TopBar() {
  const { togglePalette, rightPanel, toggleRightPanel } = useShell();
  const { theme, toggleTheme } = useTheme();
  const isMobile = useIsMobile();

  return (
    <header className="flex h-(--header-height) shrink-0 items-center gap-2 border-b bg-background pr-3">
      <BrandMark />
      <SidebarTrigger className="ml-1" />
      <Separator
        orientation="vertical"
        className="mr-1 data-vertical:h-4 data-vertical:self-center"
      />
      <ShellBreadcrumbs />

      <div className="ml-auto flex items-center gap-1">
        <Button
          variant="outline"
          size="sm"
          onClick={togglePalette}
          className="text-muted-foreground"
          aria-label="Open command palette"
        >
          <SearchIcon />
          <span className="hidden sm:inline">Search…</span>
          <kbd className="hidden rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium sm:inline">
            ⌘K
          </kbd>
        </Button>
        <Button
          variant="ghost"
          size="icon"
          onClick={toggleTheme}
          aria-label={theme === 'dark' ? 'Switch to light' : 'Switch to dark'}
        >
          {theme === 'dark' ? <MoonIcon /> : <SunIcon />}
        </Button>
        <NotificationsBell />
        {!isMobile && (
          <Button
            variant="ghost"
            size="icon"
            onClick={toggleRightPanel}
            aria-pressed={rightPanel.open}
            aria-label={
              rightPanel.open ? 'Hide context panel' : 'Show context panel'
            }
          >
            <PanelRightIcon />
          </Button>
        )}
      </div>
    </header>
  );
}
