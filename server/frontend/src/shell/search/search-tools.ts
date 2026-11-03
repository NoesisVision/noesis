import { useQuery } from '@tanstack/react-query';
import { type NavigateOptions, useNavigate } from '@tanstack/react-router';
import { useEffect, useLayoutEffect, useRef } from 'react';
import { z } from 'zod';
import { currentProject } from '#/features/project/project.api.ts';
import { newestSystemModel } from '#/features/system-model/system-model.api.ts';
import { useDevToolsContext } from '#/shared/dev-tools/dev-tools-context.tsx';
import {
  registerTools,
  ToolRefusal,
  type WebTool,
  webTool,
} from '#/shared/web-mcp/web-mcp.ts';
import { useChangeNav } from '#/shell/navigation/use-change-nav.ts';
import {
  type MatchingGroup,
  matchingGroups,
  type SearchEntry,
  type SearchSources,
  searchGroups,
} from './search-entries.ts';

/*
 * The app's search offered to an agent in the browser from every page: it
 * finds what the search dialog finds, in the order it lists it — what is in
 * the change you are in, the system model and its elements, the other
 * changes — and takes the reader where a click on a result in the dialog
 * would, once the search names one result alone.
 */

/** A result as a tool names it. */
const resultOf = ({ id, label, context }: SearchEntry) => ({
  id,
  name: label,
  context,
});

/**
 * The one result a search names: the only one whose name is the query, or
 * the only one found at all. Several of the same name name none.
 */
function namedBy(
  groups: MatchingGroup[],
  query: string,
): SearchEntry | undefined {
  const found = groups.flatMap(({ entries }) => entries);
  const words = query.trim().toLowerCase();
  const exact = found.filter((entry) => entry.label.toLowerCase() === words);
  if (exact.length === 1) return exact[0];
  if (exact.length === 0 && found.length === 1) return found[0];
  return undefined;
}

export function searchTools(
  sources: () => SearchSources,
  open: (link: NavigateOptions) => Promise<void>,
): WebTool[] {
  return [
    webTool({
      name: 'search_noesis',
      description:
        "The search for anything in Noesis: use it whenever the user asks to find, search for, look up, open, go to or be taken to something, on any page, the system model exploration diagram included — in the model or the system model (a module, class, aggregate, entity, value object, service, command, query, event…), or a change, document or design doc. Searches as Noesis's search dialog does, by name or kind, and takes the user where clicking the result in the dialog would — a model element to its row in the system model tree, a document or design doc to its page — when the query names one result alone. When several match, it opens none and lists them, grouped in the dialog's order: open the one meant with open_search_result.",
      input: z.object({
        query: z
          .string()
          .describe(
            "What to find: the element's or page's name, or words of it, any case. Empty lists all but the fine grain (model elements, design doc views).",
          ),
      }),
      run: async ({ query }) => {
        const groups = matchingGroups(searchGroups(sources()), query);
        const named = query.trim() === '' ? undefined : namedBy(groups, query);
        if (named !== undefined) {
          await open(named.link);
          return { opened: resultOf(named) };
        }
        return {
          opened: null,
          groups: groups.map(({ label, entries, more }) => ({
            group: label,
            results: entries.map(resultOf),
            ...(more > 0 ? { more } : {}),
          })),
        };
      },
    }),
    webTool({
      name: 'open_search_result',
      description:
        'Takes the user to a result of search_noesis, as clicking it in the search dialog does: a model element to its row in the system model tree, a document or design doc to its page.',
      input: z.object({
        id: z.string().describe('The result id, as search_noesis gives it.'),
      }),
      run: async ({ id }) => {
        const entry = searchGroups(sources())
          .flatMap(({ entries }) => entries)
          .find((each) => each.id === id);
        if (entry === undefined)
          throw new ToolRefusal(
            `No search result ${id}; take an id from search_noesis.`,
          );
        await open(entry.link);
        return { opened: resultOf(entry) };
      },
    }),
  ];
}

/** Offers the app's search while the dev tools flag is on. */
export function useSearchTools(): void {
  const {
    features: { webMcpTools },
  } = useDevToolsContext();
  const navigate = useNavigate();
  const { changes, activeChange } = useChangeNav();
  const { data: project } = useQuery(currentProject);
  const { data: systemModel = null } = useQuery(newestSystemModel);
  const latest = useRef({ navigate, sources: {} as SearchSources });
  useLayoutEffect(() => {
    latest.current = {
      navigate,
      sources: {
        changes,
        activeChange,
        projectName: project?.name,
        systemModel,
      },
    };
  });
  useEffect(() => {
    if (!webMcpTools) return;
    return registerTools(
      searchTools(
        () => latest.current.sources,
        (link) => latest.current.navigate({ ...link, viewTransition: true }),
      ),
    );
  }, [webMcpTools]);
}
