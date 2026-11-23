import {
  type ElementChoice,
  type ExploredElement,
  RELATIONS,
  type RelationKind,
  type SlotsHidden,
} from '../../system-model-exploration.ts';
import type { ExplorationNode } from './exploration-node.ts';
import { nodeOf } from './exploration-nodes.ts';

/** The diagram as one step left it, enough to put it back as it stood. */
export interface DiagramStep {
  choice: ElementChoice;
  relations: ReadonlySet<RelationKind>;
  /** The groups of slots the reader hid, card by card. */
  slotsHidden: SlotsHidden;
  nodes: ExplorationNode[];
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
 *
 * Steps kept before slots were always drawn on cards (version 1) are not
 * read: they hold cards for the types slots name, which are badges now, so
 * they cannot be put back as they stood. What was drawn is still kept, as
 * the choice is (exploration-memory.ts), and is placed afresh. So are the
 * steps kept before cards were as wide as their names from further off
 * (version 2): their cards are too narrow for them. Until version 4 a
 * step kept each card whole, its element with it, ten times the size. And
 * the steps kept before a module's top was as tall as its larger name, and
 * a card as tall as its name and signature alone (version 4), stand
 * where the name would lie over them.
 */
const VERSION = 5;
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

/**
 * A card as it is kept: which element it is, where it stands, how large,
 * and what it is drawn inside. Not the element itself: the model holds
 * that, and a step of every card with its element is soon most of what
 * the machine has room for, written anew each time a card is let go of.
 */
interface StoredNode {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  holds: boolean;
  parent: string | null;
}

interface StoredStep {
  added: string[];
  removed: string[];
  bySlot: string[];
  relations: RelationKind[];
  /** Absent from a step kept before slots could be hidden card by card. */
  hiddenState?: string[];
  hiddenSignature?: string[];
  nodes: StoredNode[];
}

const storedNodeOf = ({
  id,
  position,
  width,
  height,
  data: { placed },
}: ExplorationNode): StoredNode => ({
  id,
  x: position.x,
  y: position.y,
  width: width ?? placed.width,
  height: height ?? placed.height,
  holds: placed.holds,
  parent: placed.element.parent,
});

const storedOf = ({
  choice,
  relations,
  slotsHidden,
  nodes,
}: DiagramStep): StoredStep => ({
  added: [...choice.picks.added],
  removed: [...choice.picks.removed],
  bySlot: [...(choice.picks.bySlot ?? [])],
  relations: [...relations],
  hiddenState: [...slotsHidden.state],
  hiddenSignature: [...slotsHidden.signature],
  nodes: nodes.map(storedNodeOf),
});

export function rememberSteps(modelId: string, steps: DiagramSteps): void {
  let { list, at } = steps;
  let room = false;
  while (list.length > 0) {
    try {
      window.localStorage.setItem(
        keyOf(modelId),
        JSON.stringify({
          v: VERSION,
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

/**
 * The steps kept for a model, each card built again from the model's own
 * element; a card whose element the model no longer holds is left out.
 */
export function recallSteps(
  modelId: string,
  elements: ReadonlyMap<string, ExploredElement>,
): DiagramSteps | null {
  const stored = readStored(modelId);
  if (stored === null) return null;
  // Kept while containment could be switched off: a step that drew no card
  // inside another cannot be put back as it stood, so all are placed afresh.
  if (stored.list.some(({ relations }) => !relations.includes('contains')))
    return null;
  return {
    at: stored.at,
    edges: stored.edges,
    list: stored.list.map((step) => ({
      choice: {
        shown: new Set(),
        picks: {
          added: new Set(step.added),
          removed: new Set(step.removed),
          bySlot: new Set(step.bySlot),
        },
      },
      relations: new Set(step.relations),
      slotsHidden: {
        state: new Set(step.hiddenState),
        signature: new Set(step.hiddenSignature),
      },
      nodes: step.nodes.flatMap(({ id, parent, ...placed }) => {
        const element = elements.get(id);
        return element === undefined
          ? []
          : [nodeOf({ ...placed, element: { ...element, parent } })];
      }),
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

/** A card as it is kept: its element's id, its place and its size. */
function isNode(value: unknown): value is StoredNode {
  if (typeof value !== 'object' || value === null) return false;
  const parent = field(value, 'parent');
  return (
    typeof field(value, 'id') === 'string' &&
    ['x', 'y', 'width', 'height'].every((each) =>
      isNumber(field(value, each)),
    ) &&
    typeof field(value, 'holds') === 'boolean' &&
    (parent === null || typeof parent === 'string')
  );
}

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
  // A step saved with the routes edges once ran, or the way the layout
  // once ran, is read without them.
  const nodes = field(value, 'nodes');
  const namesOrNone = (name: string) => {
    const names = field(value, name);
    return names === undefined || isNames(names);
  };
  return (
    isNames(field(value, 'added')) &&
    isNames(field(value, 'removed')) &&
    isNames(field(value, 'bySlot')) &&
    namesOrNone('hiddenState') &&
    namesOrNone('hiddenSignature') &&
    Array.isArray(relations) &&
    relations.every(isRelation) &&
    Array.isArray(nodes) &&
    nodes.every(isNode)
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
    if (field(parsed, 'v') !== VERSION || !isNumber(at)) return null;
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
