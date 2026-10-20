import {
  type Containment,
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
  containment: Containment;
  direction: LayoutDirection;
  nodes: ExplorationNode[];
  routes: EdgeRoutes;
}

/** The steps the diagram took, and the one it stands at. */
export interface DiagramSteps {
  list: DiagramStep[];
  at: number;
}

/*
 * The steps kept for as long as the reader is here, as the choice of what
 * to draw is: the session, not the machine. One model's steps name its
 * elements, so each scanned model keeps its own, and a new scan, with an id
 * of its own, starts afresh.
 */
const keyOf = (modelId: string) =>
  `noesis.systemModel.exploration.steps.${modelId}`;

interface StoredStep {
  added: string[];
  removed: string[];
  relations: RelationKind[];
  containment: Containment;
  direction: LayoutDirection;
  nodes: ExplorationNode[];
  routes: [string, { x: number; y: number }[]][];
}

const storedOf = ({
  choice,
  relations,
  containment,
  direction,
  nodes,
  routes,
}: DiagramStep): StoredStep => ({
  added: [...choice.picks.added],
  removed: [...choice.picks.removed],
  relations: [...relations],
  containment,
  direction,
  nodes,
  routes: [...routes],
});

export function rememberSteps(modelId: string, steps: DiagramSteps): void {
  // When the session has no room for them all, the oldest go first.
  let { list, at } = steps;
  while (list.length > 0) {
    try {
      window.sessionStorage.setItem(
        keyOf(modelId),
        JSON.stringify({ v: 1, at, list: list.map(storedOf) }),
      );
      return;
    } catch {
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
    list: stored.list.map((step) => ({
      choice: {
        shown: new Set(),
        picks: { added: new Set(step.added), removed: new Set(step.removed) },
      },
      relations: new Set(step.relations),
      containment: step.containment,
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

function isStep(value: unknown): value is StoredStep {
  if (typeof value !== 'object' || value === null) return false;
  const relations = field(value, 'relations');
  const nodes = field(value, 'nodes');
  const routes = field(value, 'routes');
  const containment = field(value, 'containment');
  const direction = field(value, 'direction');
  return (
    isNames(field(value, 'added')) &&
    isNames(field(value, 'removed')) &&
    Array.isArray(relations) &&
    relations.every(isRelation) &&
    (containment === 'nested' || containment === 'edges') &&
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
): { at: number; list: StoredStep[] } | null {
  try {
    const stored = window.sessionStorage.getItem(keyOf(modelId));
    if (stored === null) return null;
    const parsed: unknown = JSON.parse(stored);
    if (typeof parsed !== 'object' || parsed === null) return null;
    const at = field(parsed, 'at');
    const list = field(parsed, 'list');
    if (field(parsed, 'v') !== 1 || !isNumber(at)) return null;
    if (!Array.isArray(list) || !list.every(isStep) || list.length === 0)
      return null;
    return { at: Math.min(Math.max(0, at), list.length - 1), list };
  } catch {
    return null;
  }
}
