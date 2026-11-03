import { z } from 'zod';
import {
  ToolRefusal,
  type WebTool,
  webTool,
} from '#/shared/web-mcp/web-mcp.ts';
import {
  addressOf,
  CHAIN_REACHES,
  chainOf,
  elementSectionsOf,
  type Exploration,
  type ExplorationGraph,
  type ExploredElement,
  groupLabelOf,
  groupOf,
  kindWordOf,
  type Neighbours,
  REACHES,
  RELATIONS,
  type RelationKind,
  relationOfChain,
} from '../../system-model-exploration.ts';
import type { LayoutDirection } from './layout-exploration.ts';

/*
 * The exploration offered to an agent in the browser: tools to search and
 * read the scanned model, and to change what the diagram draws through the
 * same actions the reader's own clicks and keys take, so each change is a
 * step to go back through. What a tool gives back names elements by id,
 * name and kind, as few as answer the question.
 */

/** The exploration as it stands, read afresh by each tool. */
export interface ExplorationState {
  exploration: Exploration;
  neighbours: ReadonlyMap<string, Neighbours>;
  elements: ReadonlyMap<string, ExploredElement>;
  graph: ExplorationGraph;
  relations: ReadonlySet<RelationKind>;
  direction: LayoutDirection;
  selection: readonly string[];
  /** The groups out of sight: drawn, in their places, not shown. */
  veiled: ReadonlySet<string>;
  canUndo: boolean;
  canRedo: boolean;
}

/**
 * What the tools may do to the diagram. Each resolves once the cards have
 * landed where it puts them.
 */
export interface ExplorationActions {
  /** Puts these on the diagram, placed anew, and takes them in hand. */
  show: (ids: readonly string[]) => Promise<void>;
  /** Puts these on the diagram beside a card drawn already, and takes them in hand. */
  showBeside: (ids: readonly string[], from: string) => Promise<void>;
  /** Takes these, drawn, off the diagram with all drawn inside them. */
  hide: (ids: readonly string[]) => Promise<void>;
  setRelations: (relations: ReadonlySet<RelationKind>) => Promise<void>;
  /** Takes these, drawn, in hand; one alone is read in the panel. */
  select: (ids: readonly string[]) => Promise<void>;
  /** Brings these, drawn, into view. */
  focus: (ids: readonly string[]) => Promise<void>;
  /** Places everything anew, in this direction if one is given. */
  arrange: (direction?: LayoutDirection) => Promise<void>;
  undo: () => Promise<void>;
  redo: () => Promise<void>;
  clear: () => Promise<void>;
}

/** The tool whose being offered says the exploration's tools are. */
export const SEARCH_ELEMENTS = 'find_diagram_element_ids';

/** The most elements a search gives back, and the most it is asked for. */
const SEARCH_LIMIT = 20;
const SEARCH_MAX = 100;
/** The most neighbours a description lists for each way, the rest counted. */
const NEIGHBOUR_LIMIT = 50;

const KINDS = ['module', 'building_block', 'behavior'] as const;
const RELATION_KINDS = RELATIONS.map(({ kind }) => kind) as [
  RelationKind,
  ...RelationKind[],
];

const ID_FORMAT =
  'An element id is its kind and path, as `building_block|shop.orders.Order`; take it from find_diagram_element_ids, never guess it.';

const ids = z
  .array(z.string())
  .min(1)
  .describe('Element ids, as find_diagram_element_ids gives them.');

/** How a tool names each element, against the diagram as it stands. */
function summariesOf(state: ExplorationState) {
  const drawn = new Set(state.graph.elements.map(({ id }) => id));
  return (element: ExploredElement) => {
    const container =
      element.container === null
        ? undefined
        : state.elements.get(element.container);
    return {
      id: element.id,
      name: element.name,
      kind: kindWordOf(element),
      path: addressOf(element.id),
      ...(container === undefined ? {} : { in: container.name }),
      drawn: drawn.has(element.id),
    };
  };
}

/** The elements these ids name; any it does not know refuses the call. */
function known(state: ExplorationState, asked: readonly string[]) {
  const unknown = asked.filter((id) => !state.elements.has(id));
  if (unknown.length > 0)
    throw new ToolRefusal(
      `The model has no element ${unknown.join(', ')}. ${ID_FORMAT}`,
    );
  return asked.flatMap((id) => state.elements.get(id) ?? []);
}

/** The elements these ids name, each drawn; any not drawn refuses the call. */
function drawnOf(state: ExplorationState, asked: readonly string[]) {
  known(state, asked);
  const drawn = new Set(state.graph.elements.map(({ id }) => id));
  const missing = asked.filter((id) => !drawn.has(id));
  if (missing.length > 0)
    throw new ToolRefusal(
      `Not on the diagram: ${missing.join(', ')}. Show them first with show_elements.`,
    );
  return asked;
}

/** What is inside an element, all the way down. */
function insideOf(state: ExplorationState, id: string): string[] {
  return (state.neighbours.get(id)?.contains ?? []).flatMap((kid) => [
    kid,
    ...insideOf(state, kid),
  ]);
}

/** How well a name or path answers a search: lower is better, null not at all. */
function rankOf(element: ExploredElement, query: string): number | null {
  const name = element.name.toLowerCase();
  const path = addressOf(element.id).toLowerCase();
  if (name === query) return 0;
  if (name.startsWith(query)) return 1;
  if (name.includes(query)) return 2;
  if (path.includes(query)) return 3;
  return null;
}

/** The diagram in brief, as a change leaves it. */
function briefOf(state: ExplorationState) {
  return {
    drawn: state.graph.elements.length,
    edges: state.graph.relations.length,
    selected: state.selection,
    canUndo: state.canUndo,
    canRedo: state.canRedo,
  };
}

/** The diagram whole: what is drawn, how, and what is in hand. */
function diagramOf(state: ExplorationState) {
  const names = (id: string) => state.elements.get(id)?.name ?? id;
  return {
    relations: [...state.relations],
    direction: state.direction,
    elements: state.graph.elements.map((element) => ({
      id: element.id,
      name: element.name,
      kind: kindWordOf(element),
      ...(element.parent === null ? {} : { inside: element.parent }),
    })),
    edges: state.graph.relations.map(({ kind, source, target }) => ({
      kind,
      from: names(source),
      to: names(target),
      source,
      target,
    })),
    selected: state.selection,
    outOfSight: [...state.veiled],
    canUndo: state.canUndo,
    canRedo: state.canRedo,
  };
}

export function explorationTools(
  now: () => ExplorationState,
  act: ExplorationActions,
): WebTool[] {
  return [
    webTool({
      name: SEARCH_ELEMENTS,
      description: `Not a search for the user: finds the element ids the exploration diagram's tools (show_elements, show_chain, describe_element…) take, by name or path, best match first, saying whether each is drawn. Use it only when the user asks to draw, add, show or explore something on the diagram. To find, search for, open or go to something — "search for X", "find X in the model", "take me to X" — use search_noesis, which takes the user to it in the system model, even from this diagram. ${ID_FORMAT}`,
      readOnly: true,
      input: z.object({
        query: z
          .string()
          .describe(
            'Part of a name or a dotted path, any case; empty lists all.',
          ),
        kind: z.enum(KINDS).optional().describe('Only elements of this kind.'),
        type: z
          .string()
          .optional()
          .describe(
            'Only elements of this type, as list_element_groups names it (e.g. "aggregate", "command").',
          ),
        limit: z.number().int().min(1).max(SEARCH_MAX).optional(),
      }),
      run: ({ query, kind, type, limit = SEARCH_LIMIT }) => {
        const state = now();
        const summary = summariesOf(state);
        const wanted = query.trim().toLowerCase();
        const found = state.exploration.elements
          .filter(
            (element) =>
              (kind === undefined || element.kind === kind) &&
              (type === undefined || groupOf(element) === type),
          )
          .flatMap((element) => {
            const rank = rankOf(element, wanted);
            return rank === null ? [] : [{ element, rank }];
          })
          .sort(
            (a, b) =>
              a.rank - b.rank || a.element.name.localeCompare(b.element.name),
          );
        return {
          total: found.length,
          elements: found
            .slice(0, limit)
            .map(({ element }) => summary(element)),
        };
      },
    }),
    webTool({
      name: 'describe_element',
      description: `Reads one element of the system model: what it is, what holds it, and whom it is joined to each way — what it contains, is part of, uses, is used by, invokes and is invoked by. ${ID_FORMAT}`,
      readOnly: true,
      input: z.object({ id: z.string().describe('The element id.') }),
      run: ({ id }) => {
        const state = now();
        const summary = summariesOf(state);
        const [element] = known(state, [id]);
        const joined = state.neighbours.get(id);
        const ways = Object.fromEntries(
          REACHES.flatMap((reach) => {
            const all = joined?.[reach] ?? [];
            if (all.length === 0) return [];
            return [
              [
                reach,
                {
                  count: all.length,
                  elements: known(state, all.slice(0, NEIGHBOUR_LIMIT)).map(
                    summary,
                  ),
                },
              ],
            ];
          }),
        );
        return { ...summary(element!), ...ways };
      },
    }),
    webTool({
      name: 'list_element_groups',
      description:
        'Lists the kinds and types of element the system model holds — modules, each type of building block, each type of behavior — with how many of each.',
      readOnly: true,
      input: z.object({}),
      run: () => {
        const state = now();
        return elementSectionsOf(state.exploration).map(
          ({ title, groups }) => ({
            section: title,
            groups: groups.map(({ group, count }) => ({
              type: group,
              label: groupLabelOf(group),
              count,
              outOfSight: state.veiled.has(group),
            })),
          }),
        );
      },
    }),
    webTool({
      name: 'get_diagram',
      description:
        'Reads the exploration diagram as it stands: the elements drawn (with the one each is drawn inside, when containment is drawn), the edges between them, which relations are drawn, the layout direction and what is selected.',
      readOnly: true,
      input: z.object({}),
      run: () => diagramOf(now()),
    }),
    webTool({
      name: 'find_chain',
      description: `Follows one relation from an element step after step — what it uses, what uses it, what it invokes or what invokes it — up to the next element of its own type, without drawing anything. ${ID_FORMAT}`,
      readOnly: true,
      input: z.object({
        id: z.string().describe('The element id to start from.'),
        reach: z.enum(CHAIN_REACHES),
        depth: z.number().int().min(1).max(10).optional(),
      }),
      run: ({ id, reach, depth }) => {
        const state = now();
        const summary = summariesOf(state);
        known(state, [id]);
        const chain = chainOf(
          state.neighbours,
          state.elements,
          id,
          reach,
          depth,
        );
        return {
          elements: known(state, chain).map(summary),
        };
      },
    }),
    webTool({
      name: 'show_elements',
      description: `Draws elements on the exploration diagram and selects them; with withContents, all they hold too. Elements drawn already stay as they are. Only for when the user asks to draw or add something to the diagram; to go to an element, use search_noesis. ${ID_FORMAT}`,
      input: z.object({
        ids,
        withContents: z
          .boolean()
          .optional()
          .describe('Also draw everything inside each, all the way down.'),
      }),
      run: async ({ ids: asked, withContents }) => {
        const state = now();
        known(state, asked);
        const all = withContents
          ? [...new Set(asked.flatMap((id) => [id, ...insideOf(state, id)]))]
          : asked;
        await act.show(all);
        return briefOf(now());
      },
    }),
    webTool({
      name: 'hide_elements',
      description:
        'Takes elements off the diagram, with all drawn inside them. They must be drawn.',
      input: z.object({ ids }),
      run: async ({ ids: asked }) => {
        await act.hide(drawnOf(now(), asked));
        return briefOf(now());
      },
    }),
    webTool({
      name: 'show_chain',
      description: `Draws a chain from an element, as find_chain follows it, and the relation's edges, so it reads as one; the element itself too if it is not drawn. ${ID_FORMAT}`,
      input: z.object({
        id: z.string().describe('The element id to start from.'),
        reach: z.enum(CHAIN_REACHES),
      }),
      run: async ({ id, reach }) => {
        const state = now();
        known(state, [id]);
        const drawn = new Set(state.graph.elements.map((each) => each.id));
        const missing = chainOf(
          state.neighbours,
          state.elements,
          id,
          reach,
        ).filter((each) => !drawn.has(each));
        const relation = relationOfChain(reach);
        if (!state.relations.has(relation))
          await act.setRelations(new Set([...state.relations, relation]));
        if (missing.length > 0) {
          if (drawn.has(id)) await act.showBeside(missing, id);
          else await act.show([id, ...missing]);
        } else if (!drawn.has(id)) await act.show([id]);
        return { added: missing.length, ...briefOf(now()) };
      },
    }),
    webTool({
      name: 'set_relations',
      description:
        'Chooses which relations the diagram draws: "contains" and "isPartOf" draw elements inside their containers, "uses" and "invokes" as edges.',
      input: z.object({ relations: z.array(z.enum(RELATION_KINDS)) }),
      run: async ({ relations }) => {
        await act.setRelations(new Set(relations));
        return briefOf(now());
      },
    }),
    webTool({
      name: 'select_elements',
      description:
        'Selects elements drawn on the diagram, marking what they are joined to; one alone is read in the details panel. An empty list lets go of the selection.',
      input: z.object({ ids: z.array(z.string()) }),
      run: async ({ ids: asked }) => {
        await act.select(asked.length === 0 ? [] : drawnOf(now(), asked));
        return briefOf(now());
      },
    }),
    webTool({
      name: 'focus_elements',
      description:
        'Pans and zooms the diagram to bring drawn elements into view.',
      input: z.object({ ids }),
      run: async ({ ids: asked }) => {
        await act.focus(drawnOf(now(), asked));
        return briefOf(now());
      },
    }),
    webTool({
      name: 'arrange_diagram',
      description:
        'Places every element on the diagram anew, top to bottom ("vertical") or left to right ("horizontal").',
      input: z.object({
        direction: z.enum(['vertical', 'horizontal']).optional(),
      }),
      run: async ({ direction }) => {
        await act.arrange(direction);
        return briefOf(now());
      },
    }),
    webTool({
      name: 'undo',
      description: 'Takes the diagram back one step.',
      input: z.object({}),
      run: async () => {
        if (!now().canUndo)
          throw new ToolRefusal('There is no step to go back to.');
        await act.undo();
        return briefOf(now());
      },
    }),
    webTool({
      name: 'redo',
      description: 'Takes the diagram forward one step again.',
      input: z.object({}),
      run: async () => {
        if (!now().canRedo)
          throw new ToolRefusal('There is no step to go forward to.');
        await act.redo();
        return briefOf(now());
      },
    }),
    webTool({
      name: 'clear_diagram',
      description: 'Takes everything off the diagram.',
      input: z.object({}),
      run: async () => {
        await act.clear();
        return briefOf(now());
      },
    }),
  ];
}
