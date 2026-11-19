import {
  type NodeChange,
  type OnNodeDrag,
  type ReactFlowInstance,
  useNodesState,
} from '@xyflow/react';
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';
import { byIdOf } from '#/shared/collections.ts';
import '@xyflow/react/dist/base.css';
import { useDevToolsContext } from '#/shared/dev-tools/dev-tools-context.tsx';
import { FIT } from '#/shared/ui/diagram-canvas/fit.ts';
import { type FloatingEdge } from '#/shared/ui/diagram-canvas/floating-edge.tsx';
import { type ExplorationGraph } from '../../system-model-exploration.ts';
import { type ExplorationNode } from './element-node.tsx';
import {
  absoluteOf,
  descendantsOf,
  type HeldCard,
  nodeOf,
  standingOf,
  standsAsBefore,
  withHandle,
} from './exploration-nodes.ts';
import { GLIDE_MS, LEAVING_MS, LIVE_DRAG } from './exploration-timing.ts';
import { layoutByRelations, QUICK, THOROUGH } from './layout-by-relations.ts';
import {
  layoutExploration,
  layoutWithin,
  type PlacedElement,
  type Stood,
} from './layout-exploration.ts';
import {
  arrangeWithin,
  type CanvasRect,
  landsIn,
  movedAllTo,
  refusingFrames,
  type CanvasPoint,
  placeLocally,
} from './place-locally.ts';

/*
 * Where every card stands, and how it gets there: laid out, placed beside
 * what it came from, dropped and glided, dragged, arranged, fitted. One
 * hook, its refs shared by all of it, so it is kept whole.
 */

const NONE_IN_HAND: readonly string[] = [];

/**
 * Where each card stands now, relative to its container, for a placing to
 * keep to: those still drawn, and still inside what they were inside.
 * Nothing when no card stands yet.
 */
function stoodIn(
  graph: ExplorationGraph,
  nodes: ExplorationNode[],
): Stood | undefined {
  const parentOf = new Map(
    graph.elements.map(({ id, parent }) => [id, parent]),
  );
  const stood = new Map(
    standingOf(nodes)
      .filter(({ element }) => parentOf.get(element.id) === element.parent)
      .map(({ element, x, y }) => [element.id, { x, y }]),
  );
  return stood.size === 0 ? undefined : stood;
}
const NEVER_TAKEN = () => false;

/**
 * The other cards in hand that go where a dragged one goes: none unless it
 * is in hand itself. A frame round it stays, to be fitted round it once it
 * is let go of; a card inside it, or inside another that goes, is moved by
 * what holds it.
 */
function alongWith(
  nodes: ExplorationNode[],
  dragged: string,
  inHand: readonly string[],
): ExplorationNode[] {
  if (!inHand.includes(dragged)) return [];
  const byId = byIdOf(nodes);
  const roundOf = (id: string): string[] => {
    const parent = byId.get(id)?.parentId;
    return parent === undefined ? [] : [parent, ...roundOf(parent)];
  };
  const stays = new Set(roundOf(dragged));
  const going = new Set(inHand.filter((id) => !stays.has(id)));
  return [...going].flatMap((id) => {
    const node = byId.get(id);
    if (node === undefined || node.data.leaving === true || id === dragged)
      return [];
    return roundOf(id).some((round) => going.has(round)) ? [] : [node];
  });
}

/** Where each card going along stands once the dragged one has gone from `start` to `now`. */
const alongAt = (
  along: readonly { id: string; start: CanvasPoint; origin: CanvasPoint }[],
  start: CanvasPoint,
  now: CanvasPoint,
) =>
  along.map(({ id, start: from, origin }) => ({
    id,
    origin,
    at: { x: from.x + now.x - start.x, y: from.y + now.y - start.y },
  }));

/**
 * The cards where the layout puts them, placed again whenever what is drawn
 * or how changes, or the reader asks; each placing is fitted to the canvas
 * once it lands.
 */
/** A change made from one card, to be placed beside it, not anew. */
interface LocalChange {
  /** The card it came from, or the point on the canvas it was asked for at. */
  anchor: string | CanvasPoint;
  /** The graph drawn when it was asked, so it holds for the next change only. */
  graph: ExplorationGraph | null;
}

export function usePlacement(
  graph: ExplorationGraph,
  /** Where the cards stood when the reader last left, to open at. */
  opening: { nodes: ExplorationNode[] } | null,
  /** The cards in hand: one of them dragged, the rest go with it. */
  inHand: readonly string[] = NONE_IN_HAND,
  /**
   * Whether the view is about to be taken somewhere itself — to what was
   * just added: a placing then leaves the view where it is, not fitted.
   */
  viewIsTaken: () => boolean = NEVER_TAKEN,
) {
  // A big group is dragged as it is, unless dev tools ask for its outline.
  // And the diagram is placed by its relations, unless they ask for the
  // placing by kinds alone that came before it.
  const {
    features: { outlineDragForBigGroups, placeByKinds },
  } = useDevToolsContext();
  const [nodes, setNodes, onNodesMoved] = useNodesState<ExplorationNode>([]);
  const [asked, setAsked] = useState(0);
  const [placed, setPlaced] = useState<{
    graph: ExplorationGraph;
    asked: number;
    /** Placed beside a card rather than anew, so the view stays where it is. */
    local: boolean;
  } | null>(null);
  // Read when the graph changes, without placing again when they do.
  const latest = useRef({ nodes, placed, inHand });
  useLayoutEffect(() => {
    latest.current = { nodes, placed, inHand };
  });
  const local = useRef<LocalChange | null>(null);
  // A card the next placing beside it then arranges inside.
  const arrangeAfter = useRef<readonly string[]>([]);
  /** Asks that the next change be placed beside this card, then these containers arranged. */
  const placeBeside = useCallback(
    (anchor: string | CanvasPoint, thenArrange: readonly string[] = []) => {
      local.current = { anchor, graph: latest.current.placed?.graph ?? null };
      arrangeAfter.current = thenArrange;
    },
    [],
  );
  const [failure, setFailure] = useState<string | null>(null);
  // How many placements have landed, so the edges fade in again on each.
  const [placements, setPlacements] = useState(0);
  const [flow, setFlow] = useState<ReactFlowInstance<
    ExplorationNode,
    FloatingEdge
  > | null>(null);
  // Cards glide to a new placing only just after it lands, never while one
  // is dragged — what a frame holds would trail behind it.
  const [gliding, setGliding] = useState(false);
  // Each placing's glide, and its leaving cards, end a moment after it lands.
  // The timers belong to the placing, so an effect that is cleaned up and
  // run again — React's strict mode does that to every effect on mount —
  // starts them afresh. Held anywhere else, a cleanup could cancel one with
  // nothing to start it again, and the cards would glide, trailing the
  // pointer, until the next placing.
  useEffect(() => {
    if (placements === 0) return;
    const glide = setTimeout(() => setGliding(false), GLIDE_MS);
    const gone = setTimeout(
      () => setNodes((shown) => shown.filter(({ data }) => !data.leaving)),
      LEAVING_MS,
    );
    return () => {
      clearTimeout(glide);
      clearTimeout(gone);
    };
  }, [placements, setNodes]);

  // How many times the reader moved a card by hand, so each is a step.
  const [edits, setEdits] = useState(0);
  // A drop's glide under way, stopped where it is by whatever lands next.
  const dropGlide = useRef<number | null>(null);
  const stopDropGlide = useCallback(() => {
    if (dropGlide.current !== null) cancelAnimationFrame(dropGlide.current);
    dropGlide.current = null;
  }, []);
  useEffect(() => stopDropGlide, [stopDropGlide]);

  /** Cards where a placing, or a step gone back to, puts them. */
  const landNodes = useCallback(
    (next: ExplorationNode[]) => {
      stopDropGlide();
      // A card taken off stays a moment, fading, before it is gone.
      setNodes((shown) => {
        const kept = new Set(next.map(({ id }) => id));
        const leaving = shown
          .filter(({ id }) => !kept.has(id))
          .map((node) => ({ ...node, data: { ...node.data, leaving: true } }));
        // A card that stands as it stood stays the same node, so React Flow
        // draws only those that moved.
        const before = byIdOf(shown);
        const landed = next.map((given) => {
          // A frame, saved before frames were taken by their top, is too.
          const node = withHandle(given);
          const was = before.get(node.id);
          return was !== undefined && standsAsBefore(was, node) ? was : node;
        });
        return [...landed, ...leaving];
      });
      setGliding(true);
      setPlacements((count) => count + 1);
      setFailure(null);
    },
    [setNodes, stopDropGlide],
  );

  /*
   * The cards where a card let go of puts them, moved there frame by frame
   * rather than by the page's transition: the edges are drawn from where the
   * canvas has each card, so they follow the cards the whole way and are
   * never hidden. Each card let go of goes on from where it was let go of.
   * One that changes frames, or with the reader asking for less motion,
   * goes there at once.
   */
  const dropNodes = useCallback(
    (
      next: ExplorationNode[],
      letGo: readonly { id: string; at: CanvasPoint }[],
    ) => {
      stopDropGlide();
      const from = byIdOf(latest.current.nodes);
      for (const { id, at } of letGo) {
        const was = from.get(id);
        if (was !== undefined) from.set(id, { ...was, position: at });
      }
      // Each with its size measured already, as the canvas draws no edge to
      // a card it has yet to measure: one handed over unmeasured would lose
      // its edges until the page measured it again.
      const sized = (node: ExplorationNode): ExplorationNode =>
        node.width === undefined || node.height === undefined
          ? node
          : { ...node, measured: { width: node.width, height: node.height } };
      const landed = next.map((given) => {
        const node = withHandle(given);
        const before = from.get(node.id);
        return before !== undefined && standsAsBefore(before, node)
          ? before
          : sized(node);
      });
      const still = window.matchMedia(
        '(prefers-reduced-motion: reduce)',
      ).matches;
      const started = performance.now();
      const frame = (now: number) => {
        const t = Math.min(1, (now - started) / GLIDE_MS);
        if (t === 1 || still) {
          dropGlide.current = null;
          setNodes(landed);
          // A step of its own, to go back to.
          setEdits((count) => count + 1);
          return;
        }
        const k = 1 - (1 - t) ** 3;
        const between = (a: number | undefined, b: number | undefined) =>
          a === undefined || b === undefined ? b : a + (b - a) * k;
        setNodes(
          landed.map((node) => {
            const before = from.get(node.id);
            if (
              before === undefined ||
              before === node ||
              before.parentId !== node.parentId
            )
              return node;
            return sized({
              ...node,
              position: {
                x: between(before.position.x, node.position.x)!,
                y: between(before.position.y, node.position.y)!,
              },
              width: between(before.width, node.width),
              height: between(before.height, node.height),
            });
          }),
        );
        dropGlide.current = requestAnimationFrame(frame);
      };
      dropGlide.current = requestAnimationFrame(frame);
      setFailure(null);
    },
    [setNodes, stopDropGlide],
  );
  const land = useCallback(
    (elements: PlacedElement[]) => landNodes(elements.map(nodeOf)),
    [landNodes],
  );

  // A step gone back to, to be put back as it stood rather than placed.
  const restoring = useRef<{
    nodes: ExplorationNode[];
    /** Fitted to the canvas, as a diagram opened is; a step gone back to is not. */
    fit: boolean;
  } | null>(opening === null ? null : { nodes: opening.nodes, fit: true });
  /**
   * Puts the cards back where a step had them: now, when what is drawn is
   * as it was; else once the change back to it lands, in place of a placing.
   */
  const restore = useCallback(
    (nodes: ExplorationNode[], afterChange: boolean) => {
      if (afterChange) restoring.current = { nodes, fit: false };
      else landNodes(nodes);
    },
    [landNodes],
  );

  /*
   * A card, or a group, moves as it is dragged. With the outline drag on in
   * dev tools, a big group instead stays where it stands while an outline
   * of its size follows the pointer — moved on the page directly, so
   * nothing is drawn again on the way — and goes where the outline is let
   * go of. Either way its container is fitted round it once it is let go of.
   */
  const [held, setHeld] = useState<HeldCard | null>(null);
  // Any card in hand, big or small, so the cards' tooltips stay shut.
  const [dragging, setDragging] = useState(false);
  // The card moved as it is dragged, to be drawn over the rest.
  const [raised, setRaised] = useState<string | null>(null);
  const outline = useRef<HTMLDivElement>(null);
  const holding = useRef<{
    id: string;
    origin: CanvasPoint;
    /** Where it stood when taken, relative to its container. */
    start: CanvasPoint;
    /** Moved as it is dragged, with no outline. */
    live: boolean;
    /**
     * The other cards in hand that go where it goes, each where it stood
     * when the drag began, relative to its container, and where on the
     * canvas that container stands.
     */
    along: readonly { id: string; start: CanvasPoint; origin: CanvasPoint }[];
    /** The modules it may not land in, for its outline to say so. */
    refusing: readonly CanvasRect[];
    size: { width: number; height: number };
  } | null>(null);
  const onNodeDragStart = useCallback<OnNodeDrag<ExplorationNode>>(
    (_, node) => {
      // Taken again mid-glide, the cards stay where they are.
      stopDropGlide();
      const shown = latest.current.nodes;
      const origin =
        node.parentId === undefined
          ? { x: 0, y: 0 }
          : absoluteOf(shown, node.parentId);
      setDragging(true);
      const ids = new Set([node.id, ...descendantsOf(shown, node.id)]);
      const live = !outlineDragForBigGroups || ids.size <= LIVE_DRAG;
      const along = alongWith(shown, node.id, latest.current.inHand).map(
        (each) => ({
          id: each.id,
          start: each.position,
          origin:
            each.parentId === undefined
              ? { x: 0, y: 0 }
              : absoluteOf(shown, each.parentId),
        }),
      );
      const drawn = latest.current.placed?.graph;
      // Gathered once: the frames do not move while a card is dragged.
      const refusing =
        drawn === undefined
          ? []
          : refusingFrames(standingOf(shown), drawn, node.id);
      holding.current = {
        id: node.id,
        origin,
        start: node.position,
        live,
        along,
        refusing,
        size: {
          width: node.measured?.width ?? node.width ?? 0,
          height: node.measured?.height ?? node.height ?? 0,
        },
      };
      if (live) {
        setRaised(node.id);
        return;
      }
      setHeld({
        id: node.id,
        width: node.measured?.width ?? node.width ?? 0,
        height: node.measured?.height ?? node.height ?? 0,
        at: { x: origin.x + node.position.x, y: origin.y + node.position.y },
      });
    },
    [stopDropGlide, outlineDragForBigGroups],
  );
  const onNodeDrag = useCallback<OnNodeDrag<ExplorationNode>>(
    (_, node) => {
      const now = holding.current;
      if (now === null) return;
      if (now.live) {
        // The rest of the hand goes as far as the card dragged has.
        if (now.along.length === 0) return;
        const there = byIdOf(alongAt(now.along, now.start, node.position));
        setNodes((all) =>
          all.map((each) => {
            const at = there.get(each.id)?.at;
            return at === undefined ? each : { ...each, position: at };
          }),
        );
        return;
      }
      const shown = outline.current;
      if (shown === null) return;
      const x = now.origin.x + node.position.x;
      const y = now.origin.y + node.position.y;
      shown.style.transform = `translate(${x}px, ${y}px)`;
      // Over another module the outline says it will not go in: marked on
      // the page directly, so nothing is drawn again.
      const refused = landsIn(now.refusing, { x, y, ...now.size });
      if (refused !== (shown.dataset.refused !== undefined))
        shown.toggleAttribute('data-refused', refused);
    },
    [setNodes],
  );
  const onNodeDragStop = useCallback<OnNodeDrag<ExplorationNode>>(
    (_, node) => {
      const now = holding.current;
      holding.current = null;
      setHeld(null);
      setDragging(false);
      setRaised(null);
      if (now === null) return;
      const shown = latest.current.nodes;
      if (now.start.x === node.position.x && now.start.y === node.position.y)
        return;
      const drawn = latest.current.placed?.graph;
      // The card dragged and the rest of the hand, each where it was let
      // go of.
      const letGo = [
        { id: node.id, at: node.position, origin: now.origin },
        ...alongAt(now.along, now.start, node.position),
      ];
      const elements =
        drawn === undefined
          ? null
          : movedAllTo(
              standingOf(shown),
              drawn,
              letGo.map(({ id, at, origin }) => ({
                id,
                to: { x: origin.x + at.x, y: origin.y + at.y },
              })),
            );
      if (elements !== null) return dropNodes(elements.map(nodeOf), letGo);
      // No settling what they push: each where it was let go.
      const there = byIdOf(letGo);
      setNodes((all) =>
        all.map((each) => {
          const at = there.get(each.id)?.at;
          return at === undefined ? each : { ...each, position: at };
        }),
      );
      setEdits((count) => count + 1);
    },
    [dropNodes, setNodes],
  );

  // What was last placed, known at once rather than on the next render: run
  // again with nothing changed — as React runs it twice on mounting in
  // development — the effect leaves the cards where they stand, so a
  // diagram opened where it was left is not placed anew over it.
  const settled = useRef<{
    graph: ExplorationGraph;
    asked: number;
  } | null>(null);
  useEffect(() => {
    const was = settled.current;
    if (was !== null && was.graph === graph && was.asked === asked) return;
    // Asked for by the reader, a placing is worth a moment's search; one the
    // diagram does itself, as elements are put on it, is not waited for.
    const askedFor = was !== null && was.asked !== asked;
    const done = (local: boolean) => {
      settled.current = { graph, asked };
      setPlaced({ graph, asked, local });
    };

    // A step gone back to stands as it stood.
    const back = restoring.current;
    if (back !== null) {
      restoring.current = null;
      local.current = null;
      landNodes(back.nodes);
      done(!back.fit);
      return;
    }

    // A change from one card is placed beside it, the rest left standing
    // where the reader sees it, dragged or not; failing that, anew.
    const change = local.current;
    local.current = null;
    const last = latest.current.placed;
    if (
      change !== null &&
      last !== null &&
      last.graph === change.graph &&
      last.asked === asked
    ) {
      const elements = placeLocally(
        standingOf(latest.current.nodes),
        graph,
        change.anchor,
      );
      if (elements !== null) {
        land(elements);
        done(true);
        return;
      }
    }

    try {
      land(
        (placeByKinds
          ? layoutExploration(graph)
          : layoutByRelations(
              graph,
              null,
              askedFor ? THOROUGH : QUICK,
              stoodIn(graph, latest.current.nodes),
            )
        ).elements,
      );
    } catch (error) {
      setFailure(error instanceof Error ? error.message : String(error));
    }
    done(false);
  }, [graph, asked, land, landNodes, placeByKinds]);

  /**
   * What a container holds placed anew inside it, from what is drawn now;
   * when that cannot be done without moving the rest, everything anew.
   */
  const arrange = useCallback(
    (id: string) => {
      const drawn = latest.current.placed?.graph;
      // Only a container drawn round others has anything to arrange.
      if (
        drawn === undefined ||
        !drawn.elements.some(({ parent }) => parent === id)
      )
        return;
      const elements = arrangeWithin(
        standingOf(latest.current.nodes),
        drawn,
        id,
        placeByKinds
          ? layoutWithin(drawn, id)
          : layoutByRelations(
              drawn,
              id,
              THOROUGH,
              stoodIn(drawn, latest.current.nodes),
            ).elements,
      );
      if (elements === null) setAsked((count) => count + 1);
      else land(elements);
    },
    [land, placeByKinds],
  );

  // Once a change from a card has landed beside it, the containers it asked
  // for are arranged, one after another, each from where the last left the
  // cards; placed anew instead, they are already.
  useEffect(() => {
    const ids = arrangeAfter.current;
    if (ids.length === 0 || placed === null) return;
    arrangeAfter.current = [];
    if (!placed.local) return;
    void ids.reduce(
      (before, id) =>
        before
          .then(
            () => new Promise((drawnNow) => requestAnimationFrame(drawnNow)),
          )
          .then(() => arrange(id)),
      Promise.resolve(),
    );
  }, [placed, arrange]);

  useEffect(() => {
    if (placed === null || placed.local || flow === null) return;
    if (viewIsTaken()) return;
    const frame = requestAnimationFrame(() => void flow.fitView(FIT));
    return () => cancelAnimationFrame(frame);
  }, [placed, flow, viewIsTaken]);

  // A card being dragged keeps its place until let go of: only its outline
  // moves.
  const onNodesChange = useCallback(
    (all: NodeChange<ExplorationNode>[]) => {
      const now = holding.current;
      const dragged = now === null || now.live ? undefined : now.id;
      const changes = all.filter(
        (change) => !(change.type === 'position' && change.id === dragged),
      );
      if (changes.length === 0) return;
      onNodesMoved(changes);
    },
    [onNodesMoved],
  );

  const autoPlace = useCallback(() => setAsked((count) => count + 1), []);
  const placing =
    placed === null || placed.graph !== graph || placed.asked !== asked;
  return {
    nodes,
    placements,
    onNodesChange,
    placing,
    failure,
    autoPlace,
    placeBeside,
    arrange,
    gliding,
    restore,
    edits,
    onNodeDragStart,
    onNodeDrag,
    onNodeDragStop,
    held,
    dragging,
    raised,
    outline,
    flow,
    setFlow,
  };
}
