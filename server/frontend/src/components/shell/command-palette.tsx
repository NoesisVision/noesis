import { useQuery } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';
import * as React from 'react';
import { client } from '@/client';
import { ALL_SHELL_NAV_ITEMS } from '@/components/shell/nav-items';
import { useShell } from '@/components/shell/use-shell';
import { useTheme } from '@/components/shell/use-theme';
import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
} from '@/components/ui/command';
import { useSidebar } from '@/components/ui/sidebar';

const SEARCH_DEBOUNCE_MS = 200;

function useDebounced(value: string, delayMs: number): string {
  const [debounced, setDebounced] = React.useState(value);

  React.useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);

  return debounced;
}

// Entity results come from the server's provider registry. It answers with an
// empty list today — nothing is searchable yet — so this group is wired end to
// end and will fill up on its own once providers register.
function useEntitySearch(query: string) {
  const trimmed = query.trim();

  return useQuery({
    queryKey: ['ui', 'search', trimmed],
    enabled: trimmed !== '',
    queryFn: async () => {
      const response = await client.ui.search.$get({ query: { q: trimmed } });
      if (!response.ok) {
        throw new Error(`Search failed with status ${response.status}`);
      }
      const { results } = await response.json();
      return results;
    },
  });
}

export function CommandPalette() {
  const { paletteOpen, setPaletteOpen, viewId, toggleRightPanel } = useShell();
  const { toggleTheme, theme } = useTheme();
  const { toggleSidebar } = useSidebar();
  const navigate = useNavigate();
  const [query, setQuery] = React.useState('');
  const debouncedQuery = useDebounced(query, SEARCH_DEBOUNCE_MS);
  const entities = useEntitySearch(debouncedQuery);

  function run(action: () => void) {
    setPaletteOpen(false);
    setQuery('');
    action();
  }

  return (
    <CommandDialog
      open={paletteOpen}
      onOpenChange={(open) => {
        setPaletteOpen(open);
        if (!open) setQuery('');
      }}
    >
      <Command shouldFilter>
        <CommandInput
          placeholder="Search views, actions, entities…"
          value={query}
          onValueChange={setQuery}
        />
        <CommandList>
          <CommandEmpty>No matching command.</CommandEmpty>

          <CommandGroup heading="Navigation">
            {ALL_SHELL_NAV_ITEMS.map((item) => {
              const Icon = item.icon;
              return (
                <CommandItem
                  key={item.viewId}
                  value={`Go to ${item.title}`}
                  data-checked={item.viewId === viewId}
                  onSelect={() => run(() => navigate({ to: item.to }))}
                >
                  <Icon />
                  <span>Go to {item.title}</span>
                </CommandItem>
              );
            })}
          </CommandGroup>

          <CommandSeparator />

          <CommandGroup heading="Actions">
            <CommandItem
              value="Toggle sidebar"
              onSelect={() => run(toggleSidebar)}
            >
              <span>Toggle sidebar</span>
              <CommandShortcut>⌘B</CommandShortcut>
            </CommandItem>
            <CommandItem value="Toggle theme" onSelect={() => run(toggleTheme)}>
              <span>Switch to {theme === 'dark' ? 'light' : 'dark'} theme</span>
            </CommandItem>
            <CommandItem
              value="Toggle right panel"
              onSelect={() => run(toggleRightPanel)}
            >
              <span>Toggle context panel</span>
              <CommandShortcut>⌘.</CommandShortcut>
            </CommandItem>
          </CommandGroup>

          {debouncedQuery.trim() !== '' && (
            <>
              <CommandSeparator />
              {/* forceMount: the server already matched these against the
                  query, and the group's status line has to show even when it
                  comes back empty — cmdk hides groups with no visible item. */}
              <CommandGroup heading="Entities" forceMount>
                {entities.data?.length ? (
                  entities.data.map((result) => (
                    <CommandItem
                      key={`${result.type}:${result.id}`}
                      forceMount
                      value={`${result.title} ${result.subtitle ?? ''}`}
                      onSelect={() =>
                        run(() => {
                          if (result.href) navigate({ href: result.href });
                        })
                      }
                    >
                      <span className="truncate">{result.title}</span>
                      <span className="ml-auto text-xs text-muted-foreground">
                        {result.subtitle ?? result.type}
                      </span>
                    </CommandItem>
                  ))
                ) : (
                  <div className="px-2 py-3 text-sm text-muted-foreground">
                    {entities.isFetching
                      ? 'Searching…'
                      : 'Nothing searchable yet — documents, graph nodes and projects appear here once their providers register.'}
                  </div>
                )}
              </CommandGroup>
            </>
          )}
        </CommandList>
      </Command>
    </CommandDialog>
  );
}
