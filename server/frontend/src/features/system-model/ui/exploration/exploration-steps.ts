import {
  type ElementChoice,
  RELATIONS,
  type RelationKind,
} from '../../system-model-exploration.ts';
import type { ExplorationNode } from './element-node.tsx';
import type { EdgeRoutes, LayoutDirection } from './layout-exploration.ts';

/** The diagram as one step left it, enough to put it back as it stood. */
export interface DiagramStep {
  choice: ElementChoice;
  relations: ReadonlySet<RelationKind>;
  direction: LayoutDirection;
  nodes: ExplorationNode[];
  routes: EdgeRoutes;
}

/** How the edges are drawn: kept with the diagram, but not a step of it. */
interface EdgeLook {
  orthogonal: boolean;
  animated: boolean;
}

/** The steps the diagram took, and the one it stands at. */
export interface DiagramSteps {
  list: DiagramStep[];
  at: number;
  edges?: EdgeLook;
}

/*
 * The steps kept on the machine, as the choice of what to draw is, so the
 * diagram opens as it was last seen — after a reload, in a new tab, another
 * day. One model's steps name its elements, so each scanned model keeps its
 * own, and a new scan, with an id of its own, is placed afresh. Only the
 * models last drawn keep theirs: scans come often, and the room is shared.
 */
const PREFIX = 'noesis.systemModel.exploration.steps.';
const keyOf = (modelId: string) => `${PREFIX}${modelId}`;
/** How many models' diagrams are kept, the latest drawn. */
const MODELS_KEPT = 5;

/** When each kept diagram was last saved, by its key. */
function keptDiagrams(): { key: string; savedAt: number }[] {
  const kept: { key: string; savedAt: number }[] = [];
  for (let index = 0; index < window.localStorage.length; index++) {
    const key = window.localStorage.key(index);
    if (key === null || !key.startsWith(PREFIX)) continue;
    let savedAt = 0;
    try {
      const parsed: unknown = JSON.parse(window.localStorage.getItem(key)!);
      const at =
        typeof parsed === 'object' && parsed !== null
          ? field(parsed, 'savedAt')
          : null;
      if (isNumber(at)) savedAt = at;
    } catch {
      // Unreadable: the first to go.
    }
    kept.push({ key, savedAt });
  }
  return kept;
}

/** Forgets every diagram but this model's and, unless `all`, the latest others. */
function forgetOthers(modelId: string, all: boolean): void {
  const others = keptDiagrams()
    .filter(({ key }) => key !== keyOf(modelId))
    .sort((a, b) => b.savedAt - a.savedAt);
  for (const { key } of others.slice(all ? 0 : MODELS_KEPT - 1))
    window.localStorage.removeItem(key);
}

interface StoredStep {
  added: string[];
  removed: string[];
  relations: RelationKind[];
  direction: LayoutDirection;
  nodes: ExplorationNode[];
  routes: [string, { x: number; y: number }[]][];
}

const storedOf = ({
  choice,
  relations,
  direction,
  nodes,
  routes,
}: DiagramStep): StoredStep => ({
  added: [...choice.picks.added],
  removed: [...choice.picks.removed],
  relations: [...relations],
  direction,
  nodes,
  routes: [...routes],
});

export function rememberSteps(modelId: string, steps: DiagramSteps): void {
  let { list, at } = steps;
  let room = false;
  while (list.length > 0) {
    try {
      window.localStorage.setItem(
        keyOf(modelId),
        JSON.stringify({
          v: 1,
          savedAt: Date.now(),
          at,
          list: list.map(storedOf),
          edges: steps.edges,
        }),
      );
      forgetOthers(modelId, false);
      return;
    } catch {
      // With no room, other models' diagrams go first, then this one's
      // oldest steps.
      if (!room) {
        room = true;
        try {
          forgetOthers(modelId, true);
        } catch {
          // Storage unavailable: the steps are kept no further.
          return;
        }
        continue;
      }
      const drop = Math.max(1, Math.floor(list.length / 2));
      list = list.slice(drop);
      at = Math.max(0, at - drop);
    }
  }
}

export function recallSteps(modelId: string): DiagramSteps | null {
  const stored = readStored(modelId);
  if (stored === null) return null;
  return {
    at: stored.at,
    edges: stored.edges,
    list: stored.list.map((step) => ({
      choice: {
        shown: new Set(),
        picks: { added: new Set(step.added), removed: new Set(step.removed) },
      },
      relations: new Set(step.relations),
      direction: step.direction,
      nodes: step.nodes,
      routes: new Map(step.routes),
    })),
  };
}

const isNames = (value: unknown): value is string[] =>
  Array.isArray(value) && value.every((each) => typeof each === 'string');

const isRelation = (value: unknown): value is RelationKind =>
  RELATIONS.some(({ kind }) => kind === value);

const isNumber = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value);

const field = (value: object, name: string): unknown =>
  Reflect.get(value, name);

/** A node as React Flow was given it: an id, a place, and its element. */
function isNode(value: unknown): value is ExplorationNode {
  if (typeof value !== 'object' || value === null) return false;
  const position = field(value, 'position');
  const data = field(value, 'data');
  if (typeof position !== 'object' || position === null) return false;
  if (typeof data !== 'object' || data === null) return false;
  const placed = field(data, 'placed');
  if (typeof placed !== 'object' || placed === null) return false;
  const element = field(placed, 'element');
  return (
    typeof field(value, 'id') === 'string' &&
    isNumber(field(position, 'x')) &&
    isNumber(field(position, 'y')) &&
    typeof element === 'object' &&
    element !== null &&
    typeof field(element, 'id') === 'string'
  );
}

const isPoints = (value: unknown): value is { x: number; y: number }[] =>
  Array.isArray(value) &&
  value.every(
    (point: unknown) =>
      typeof point === 'object' &&
      point !== null &&
      isNumber(field(point, 'x')) &&
      isNumber(field(point, 'y')),
  );

function isEdgeLook(value: unknown): value is EdgeLook {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof field(value, 'orthogonal') === 'boolean' &&
    typeof field(value, 'animated') === 'boolean'
  );
}

function isStep(value: unknown): value is StoredStep {
  if (typeof value !== 'object' || value === null) return false;
  const relations = field(value, 'relations');
  const nodes = field(value, 'nodes');
  const routes = field(value, 'routes');
  const direction = field(value, 'direction');
  return (
    isNames(field(value, 'added')) &&
    isNames(field(value, 'removed')) &&
    Array.isArray(relations) &&
    relations.every(isRelation) &&
    (direction === 'vertical' || direction === 'horizontal') &&
    Array.isArray(nodes) &&
    nodes.every(isNode) &&
    Array.isArray(routes) &&
    routes.every(
      (route: unknown) =>
        Array.isArray(route) &&
        typeof route[0] === 'string' &&
        isPoints(route[1]),
    )
  );
}

/** The one throwing call, kept to itself: unreadable is the same as absent. */
function readStored(
  modelId: string,
): { at: number; list: StoredStep[]; edges?: EdgeLook } | null {
  try {
    const stored = window.localStorage.getItem(keyOf(modelId));
    if (stored === null) return null;
    const parsed: unknown = JSON.parse(stored);
    if (typeof parsed !== 'object' || parsed === null) return null;
    const at = field(parsed, 'at');
    const list = field(parsed, 'list');
    if (field(parsed, 'v') !== 1 || !isNumber(at)) return null;
    if (!Array.isArray(list) || !list.every(isStep) || list.length === 0)
      return null;
    const edges = field(parsed, 'edges');
    return {
      at: Math.min(Math.max(0, at), list.length - 1),
      list,
      edges: isEdgeLook(edges) ? edges : undefined,
    };
  } catch {
    return null;
  }
}
