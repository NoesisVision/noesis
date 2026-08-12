import { useMatches } from '@tanstack/react-router';
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
import { SidebarTrigger } from '@/components/ui/sidebar';
import { useIsMobile } from '@/hooks/use-mobile';

function ShellBreadcrumbs() {
  const { project } = useShell();
  const matches = useMatches();
  // Routes carry their own label in staticData, so adding a view never means
  // touching a central breadcrumb map.
  const crumbs = matches
    .map((match) => match.staticData.breadcrumb)
    .filter((crumb): crumb is string => Boolean(crumb));

  return (
    <Breadcrumb>
      <BreadcrumbList>
        <BreadcrumbItem>
          <span className="truncate text-muted-foreground">{project}</span>
        </BreadcrumbItem>
        {crumbs.map((crumb, index) => (
          <React.Fragment key={crumb}>
            <BreadcrumbSeparator />
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
    <header className="flex h-14 shrink-0 items-center gap-2 border-b bg-background px-3">
      <SidebarTrigger />
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
