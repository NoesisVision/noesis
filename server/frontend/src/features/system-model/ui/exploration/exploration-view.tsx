import {
  Background,
  BackgroundVariant,
  MarkerType,
  type NodeChange,
  Panel,
  ReactFlow,
  type ReactFlowInstance,
  useNodesState,
} from '@xyflow/react';
import '@xyflow/react/dist/base.css';
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  DesignDocumentContext,
  ElementPanel,
} from '#/features/design-docs/element-reader.ts';
import { Alert } from '#/shared/design-system/alert.tsx';
import { Box } from '#/shared/design-system/box.tsx';
import { useComputedColorScheme } from '#/shared/design-system/color-scheme.ts';
import { Stack } from '#/shared/design-system/stack.tsx';
import { Text } from '#/shared/design-system/text.tsx';
import { ZoomControls } from '#/shared/ui/zoom-controls.tsx';
import type { SystemModel } from '#backend/app/system-model/system-model.ts';
import {
  choiceWithin,
  type DrawnRelation,
  type ElementChoice,
  elementSectionsOf,
  explorationOf,
  type ExplorationGraph,
  graphOf,
  groupOf,
  hiddenBy,
  kindWordOf,
  neighboursOf,
  NOTHING_CHOSEN,
  pickedAll,
  RELATION_WORD,
  type RelationKind,
  rearrangedBy,
  relatedToAll,
  removalOf,
} from '../../system-model-exploration.ts';
import { designOf } from '../../system-model.model.ts';
import { ElementNode, type ExplorationNode } from './element-node.tsx';
import { recallChoice, rememberChoice } from './exploration-memory.ts';
import { ExplorationPicker } from './exploration-picker.tsx';
import {
  type ExplorationReading,
  ExplorationReadingContext,
} from './exploration-reading.ts';
import {
  type DiagramStep,
  type DiagramSteps,
  recallSteps,
  rememberSteps,
} from './exploration-steps.ts';
import { type Drawing, ExplorationToolbar } from './exploration-toolbar.tsx';
import {
  type EdgeRoutes,
  type LayoutAlgorithm,
  type LayoutDirection,
  layoutExploration,
  layoutWithin,
  type PlacedElement,
} from './layout-exploration.ts';
import {
  arrangeWithin,
  type CanvasPoint,
  placeLocally,
} from './place-locally.ts';
import { QuickAdd, type QuickAddSpot } from './quick-add.tsx';
import { type RelationEdge, RelationEdgeView } from './relation-edge.tsx';
import { ShortcutLegend } from './shortcut-legend.tsx';
import { VisibilityPanel } from './visibility-panel.tsx';
import classes from './exploration.module.css';

/*
 * The scanned model drawn as a diagram: its elements as cards, the relations
 * the scan holds between them as edges, or containment as cards inside
 * cards. The reader picks what is drawn and how it is placed; the layout
 * places it, and the reader may drag a card on from there until the next
 * auto-place puts everything back. A card chosen is read in a panel on the
 * canvas, its relations and what they join it to marked on the diagram;
 * hovered, a card says what its element is, as the model's tooltips do.
 */

const NODE_TYPES = { element: ElementNode };
const EDGE_TYPES = { relation: RelationEdgeView };
const FIT = { padding: 0.08 };
/** How many steps the diagram keeps to go back through. */
const STEPS = 100;

const sameSet = (a: ReadonlySet<string>, b: ReadonlySet<string>) =>
  a.size === b.size && [...a].every((each) => b.has(each));

const sameChoice = (a: ElementChoice, b: ElementChoice) =>
  sameSet(a.shown, b.shown) &&
  sameSet(a.picks.added, b.picks.added) &&
  sameSet(a.picks.removed, b.picks.removed);

/** How long a card taken off the diagram takes to leave it. */
const LEAVING_MS = 200;
/** How long the cards take to glide to where a new placing puts them. */
const GLIDE_MS = 320;
/** The one layout the reader is offered: the only one that routes edges. */
const ALGORITHM = 'layered';

export function ExplorationView({ model }: { model: SystemModel }) {
  const exploration = useMemo(() => explorationOf(model), [model]);
  const modelId = model.id;
  const neighbours = useMemo(() => neighboursOf(exploration), [exploration]);
  const elementsById = useMemo(
    () => new Map(exploration.elements.map((each) => [each.id, each])),
    [exploration],
  );
  const sections = useMemo(() => elementSectionsOf(exploration), [exploration]);
  // Nothing is drawn until the reader picks it; a scan since forgets what
  // it no longer finds.
  // The steps this model's diagram took, kept on this machine, and the one
  // it was left at, which it opens at again, unplaced.
  const [opened] = useState(() => recallSteps(model.id));
  const opening = opened?.list[opened.at] ?? null;
  const [stored, setChoice] = useState<ElementChoice>(
    () => opening?.choice ?? recallChoice(),
  );
  const choice = useMemo(
    () => choiceWithin(stored, exploration),
    [stored, exploration],
  );
  useEffect(() => rememberChoice(choice), [choice]);
  const { picks } = choice;
  const hidden = useMemo(
    () => hiddenBy(choice, exploration),
    [choice, exploration],
  );
  // Kinds out of sight: still on the diagram, in their places, not shown.
  const [veiled, setVeiled] = useState<ReadonlySet<string>>(() => new Set());
  const [seeing, setSeeing] = useState(false);
  const [relations, setRelations] = useState<ReadonlySet<RelationKind>>(
    () => opening?.relations ?? new Set(['contains', 'uses']),
  );
  const [drawing, setDrawing] = useState<Drawing>({
    containment: opening?.containment ?? 'nested',
    direction: opening?.direction ?? 'vertical',
    // How the edges were drawn when the diagram was left, as it is restored.
    orthogonal: opened?.edges?.orthogonal ?? true,
    animated: opened?.edges?.animated ?? true,
  });
  const { containment, direction, orthogonal, animated } = drawing;
  const graph = useMemo(
    () => graphOf(exploration, { hidden, relations, containment, picks }),
    [exploration, hidden, relations, containment, picks],
  );

  const {
    nodes,
    routes,
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
    onNodeDragStop,
    flow,
    setFlow,
  } = usePlacement(graph, ALGORITHM, direction, opening);

  // Every step the diagram took — what is drawn, how, and where each card
  // stands — once its cards have landed or been moved by hand, to go back
  // through and forward again.
  const steps = useRef<DiagramSteps>(opened ?? { list: [], at: -1 });
  const [stepAt, setStepAt] = useState({
    at: opened?.at ?? -1,
    count: opened?.list.length ?? 0,
  });
  const now = useRef({ stored, relations, drawing, nodes, routes });
  useLayoutEffect(() => {
    now.current = { stored, relations, drawing, nodes, routes };
  });
  // The step a move back or forward lands on is that step, not a new one;
  // so is the one the diagram opens at.
  const stepping = useRef(opening !== null);
  useEffect(() => {
    if (placements === 0) return;
    if (stepping.current) {
      stepping.current = false;
      return;
    }
    const {
      stored: choiceNow,
      relations: drawnRelations,
      drawing: how,
    } = now.current;
    const step: DiagramStep = {
      choice: choiceNow,
      relations: drawnRelations,
      containment: how.containment,
      direction: how.direction,
      nodes: now.current.nodes.filter(({ data }) => !data.leaving),
      routes: now.current.routes,
    };
    const held = steps.current;
    const list = [...held.list.slice(0, held.at + 1), step].slice(-STEPS);
    steps.current = { ...held, list, at: list.length - 1 };
    setStepAt({ at: list.length - 1, count: list.length });
    rememberSteps(modelId, steps.current);
  }, [placements, edits, modelId]);
  const goTo = useCallback(
    (by: -1 | 1) => {
      const held = steps.current;
      const step = held.list[held.at + by];
      if (step === undefined) return;
      steps.current = { ...held, at: held.at + by };
      setStepAt({ at: held.at + by, count: held.list.length });
      rememberSteps(modelId, steps.current);
      const {
        stored: choiceNow,
        relations: drawnRelations,
        drawing: how,
      } = now.current;
      const changes =
        !sameChoice(step.choice, choiceNow) ||
        !sameSet(step.relations, drawnRelations) ||
        step.containment !== how.containment ||
        step.direction !== how.direction;
      stepping.current = true;
      restore(step.nodes, step.routes, changes);
      if (!changes) return;
      setChoice(step.choice);
      setRelations(step.relations);
      setDrawing((was) => ({
        ...was,
        containment: step.containment,
        direction: step.direction,
      }));
    },
    [restore, modelId],
  );
  // How the edges are drawn, kept with the steps, so a reload draws them so.
  useEffect(() => {
    steps.current = { ...steps.current, edges: { orthogonal, animated } };
    rememberSteps(modelId, steps.current);
  }, [orthogonal, animated, modelId]);
  const undo = useCallback(() => goTo(-1), [goTo]);
  const redo = useCallback(() => goTo(1), [goTo]);
  // Ctrl+Z, or Cmd+Z on a Mac, goes back a step; with Shift, or Ctrl+Y,
  // forward again. In a field they are the field's.
  useEffect(() => {
    const onKey = (event: globalThis.KeyboardEvent) => {
      if (!(event.ctrlKey || event.metaKey) || event.altKey) return;
      if (isElsewhere(event.target)) return;
      const key = event.key.toLowerCase();
      const back = key === 'z' && !event.shiftKey;
      const forward = (key === 'z' && event.shiftKey) || key === 'y';
      if (!back && !forward) return;
      event.preventDefault();
      if (back) undo();
      else redo();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [undo, redo]);
  // A card of a kind out of sight is still laid out, only not drawn; its
  // edges go with it.
  const visibleNodes = useMemo(
    () =>
      veiled.size === 0
        ? nodes
        : nodes.map((node) =>
            veiled.has(groupOf(node.data.placed.element))
              ? { ...node, hidden: true }
              : node,
          ),
    [nodes, veiled],
  );
  const scheme = useComputedColorScheme('light');
  const [zoom, setZoom] = useState(1);
  const document = useMemo(() => designOf(model), [model]);
  // In hand, in the order taken; the last is the one the panel reads.
  const [selection, setSelection] = useState<readonly string[]>([]);
  const selected = selection.at(-1) ?? null;
  const inHandSet = useMemo(() => new Set(selection), [selection]);
  const select = useCallback((id: string, adding: boolean) => {
    setSelection((held) =>
      !adding
        ? [id]
        : held.includes(id)
          ? held.filter((each) => each !== id)
          : [...held, id],
    );
  }, []);
  const letGo = useCallback(() => setSelection([]), []);
  const readAlone = useCallback((id: string) => setSelection([id]), []);
  const [picking, setPicking] = useState(false);
  // A right click on the empty canvas: where the menu opens, and where on
  // the diagram what is picked from it goes.
  const [quick, setQuick] = useState<{
    spot: QuickAddSpot;
    at: CanvasPoint;
  } | null>(null);
  const canvas = useRef<HTMLElement>(null);
  // Space opens the picker from anywhere but a field, a control of its own
  // outside the canvas, or the picker itself.
  const pickable = exploration.elements.length > 0;
  useEffect(() => {
    if (!pickable || picking) return;
    const onKey = (event: globalThis.KeyboardEvent) => {
      if (event.key !== ' ' || event.repeat) return;
      if (event.altKey || event.ctrlKey || event.metaKey) return;
      const { target } = event;
      if (isElsewhere(target)) return;
      const onCanvas =
        target instanceof Node && canvas.current?.contains(target) === true;
      if (target !== globalThis.document.body && !onCanvas) return;
      event.preventDefault();
      setPicking(true);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [pickable, picking]);
  const related = useMemo(
    () => relatedToAll(graph, selection),
    [graph, selection],
  );
  // Read in the panel only when it is the one card in hand; several are
  // only marked on the diagram.
  const inHand = useMemo(
    () =>
      selection.length === 1
        ? (exploration.elements.find(({ id }) => id === selected) ?? null)
        : null,
    [exploration, selection, selected],
  );
  const drawn = useMemo(
    () => new Set(graph.elements.map(({ id }) => id)),
    [graph],
  );
  const isShown = useCallback((id: string) => drawn.has(id), [drawn]);
  const onShowAll = useCallback(
    (ids: readonly string[], shown: boolean) =>
      setChoice((current) => {
        const kept = choiceWithin(current, exploration);
        return { ...kept, picks: pickedAll(kept.picks, ids, shown) };
      }),
    [exploration],
  );
  // What the model holds inside each element, all the way down.
  const insideOf = useMemo(() => {
    const kids = new Map<string, string[]>();
    for (const { id, container } of exploration.elements)
      if (container !== null)
        kids.set(container, [...(kids.get(container) ?? []), id]);
    const all = (id: string): string[] =>
      (kids.get(id) ?? []).flatMap((kid) => [kid, ...all(kid)]);
    return all;
  }, [exploration]);
  // A row of the picker, clicked again and again: the element alone, then
  // it and all inside it, then none of them.
  const onPick = useCallback(
    (id: string) => {
      const inside = insideOf(id);
      if (!drawn.has(id)) onShowAll([id], true);
      else if (inside.some((each) => !drawn.has(each)))
        onShowAll([id, ...inside], true);
      else onShowAll([id, ...inside], false);
    },
    [insideOf, drawn, onShowAll],
  );
  /**
   * Takes these off the diagram from a card, and all drawn inside them, and
   * lets go of what went.
   */
  const remove = useCallback(
    (ids: readonly string[], from: string, alone = false) => {
      // Alone, a container goes and what it held stays where it stands.
      const gone = alone ? [...ids] : removalOf(graph, ids);
      // The container a group leaves is arranged again round what stays.
      placeBeside(from, alone ? [] : rearrangedBy(graph, ids));
      onShowAll(gone, false);
      setSelection((held) => held.filter((id) => !gone.includes(id)));
    },
    [graph, placeBeside, onShowAll],
  );
  const reading = useMemo<ExplorationReading>(
    () => ({
      selected: inHandSet,
      related: related.elements,
      onSelect: select,
      drawn,
      neighbours,
      elements: elementsById,
      onShow: (
        ids: readonly string[],
        shown: boolean,
        from: string,
        thenArrange = false,
      ) => {
        if (!shown) return remove(ids, from);
        placeBeside(from, thenArrange ? [from] : []);
        onShowAll(ids, shown);
      },
      onArrange: (id: string) => void arrange(id),
      onRemoveAlone: (id: string) => remove([id], id, true),
    }),
    [
      inHandSet,
      related,
      select,
      drawn,
      neighbours,
      elementsById,
      remove,
      placeBeside,
      onShowAll,
      arrange,
    ],
  );
  // Ctrl+A, or Cmd+A on a Mac, takes every card in sight in hand, from the
  // page or the canvas; in a field or the picker it is theirs, as Space is.
  useEffect(() => {
    const onKey = (event: globalThis.KeyboardEvent) => {
      if (event.key.toLowerCase() !== 'a') return;
      if (!(event.ctrlKey || event.metaKey) || event.altKey || event.shiftKey)
        return;
      const { target } = event;
      if (isElsewhere(target)) return;
      const onCanvas =
        target instanceof Node && canvas.current?.contains(target) === true;
      if (target !== globalThis.document.body && !onCanvas) return;
      const inSight = graph.elements
        .filter((element) => !veiled.has(groupOf(element)))
        .map(({ id }) => id);
      if (inSight.length === 0) return;
      event.preventDefault();
      setSelection(inSight);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [graph, veiled]);
  // Delete or Backspace takes every card in hand off the diagram, as their
  // crosses do; Escape lets go of them.
  useEffect(() => {
    if (selection.length === 0) return;
    const onKey = (event: globalThis.KeyboardEvent) => {
      if (event.altKey || event.ctrlKey || event.metaKey) return;
      if (isElsewhere(event.target)) return;
      if (event.key === 'Escape') {
        letGo();
        return;
      }
      if (event.key !== 'Delete' && event.key !== 'Backspace') return;
      const held = selection.filter((id) => drawn.has(id));
      const [first] = held;
      if (first === undefined) return;
      event.preventDefault();
      remove(held, first);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [selection, drawn, remove, letGo]);
  const edges = useMemo(
    () =>
      graph.relations.map((relation) =>
        edgeOf(relation, {
          route: orthogonal ? (routes.get(relation.id) ?? null) : null,
          orthogonal,
          animated,
          highlight:
            selection.length === 0
              ? undefined
              : related.relations.has(relation.id)
                ? 'highlighted'
                : 'faded',
        }),
      ),
    [graph, routes, orthogonal, animated, selection, related],
  );

  return (
    <Stack gap={0} flex={1} className={classes.exploration}>
      <ExplorationToolbar
        relations={relations}
        canUndo={stepAt.at > 0}
        canRedo={stepAt.at < stepAt.count - 1}
        onUndo={undo}
        onRedo={redo}
        visibility={seeing}
        onVisibility={setSeeing}
        veiledCount={veiled.size}
        drawing={drawing}
        onDrawing={setDrawing}
        onAutoPlace={autoPlace}
      >
        <ZoomControls
          zoom={zoom}
          disabled={flow === null}
          onZoomOut={() => void flow?.zoomOut()}
          onZoomIn={() => void flow?.zoomIn()}
          onFit={() => void flow?.fitView(FIT)}
        />
      </ExplorationToolbar>
      <Box
        ref={canvas}
        component="section"
        pos="relative"
        flex={1}
        mih={0}
        aria-label="Exploration of the system model"
      >
        {failure !== null ? (
          <Alert color="red" title="The elements could not be placed" m="md">
            {failure}
          </Alert>
        ) : exploration.elements.length === 0 ? (
          <Text c="dimmed" p="lg">
            The scan found no modules, building blocks or behaviours.
          </Text>
        ) : graph.elements.length === 0 ? (
          <Box h="100%" className={classes.blank} />
        ) : (
          <DesignDocumentContext.Provider value={document}>
            <ExplorationReadingContext.Provider value={reading}>
              <ReactFlow
                nodes={visibleNodes}
                edges={edges}
                nodeTypes={NODE_TYPES}
                edgeTypes={EDGE_TYPES}
                onNodesChange={onNodesChange}
                onNodeDragStop={onNodeDragStop}
                colorMode={scheme}
                fitView
                fitViewOptions={FIT}
                attributionPosition="bottom-right"
                minZoom={0.1}
                maxZoom={2}
                nodesConnectable={false}
                nodesFocusable={false}
                edgesFocusable={false}
                elementsSelectable={false}
                onInit={(instance) => {
                  setFlow(instance);
                  setZoom(instance.getZoom());
                }}
                onMove={(_, viewport) => setZoom(viewport.zoom)}
                onPaneClick={() => {
                  letGo();
                  setQuick(null);
                }}
                // A right click on the empty canvas asks what to put there;
                // a double click zooms in, as on any canvas.
                onPaneContextMenu={(event) => {
                  event.preventDefault();
                  const box = canvas.current?.getBoundingClientRect();
                  if (flow === null || box === undefined) return;
                  setQuick({
                    spot: {
                      left: event.clientX - box.left,
                      top: event.clientY - box.top,
                    },
                    at: flow.screenToFlowPosition({
                      x: event.clientX,
                      y: event.clientY,
                    }),
                  });
                }}
                // Changed on each placement, so the edges fade in anew once
                // the cards have moved to where it puts them.
                className={`${
                  placements % 2 === 0 ? classes.settled : classes.resettled
                } ${gliding ? classes.gliding : ''}`}
              >
                {inHand !== null && (
                  // Its own scroll and clicks: a wheel over it reads on rather than zooms.
                  <Panel
                    position="top-right"
                    className={`nowheel nopan ${classes.selection}`}
                  >
                    <section aria-label="Selection">
                      <ElementPanel
                        key={inHand.id}
                        id={inHand.id}
                        document={document}
                        eyebrow={kindWordOf(inHand)}
                        title={inHand.name}
                        onSelectElement={readAlone}
                      />
                    </section>
                  </Panel>
                )}
                <Background
                  variant={BackgroundVariant.Dots}
                  gap={16}
                  size={1}
                  color="light-dark(var(--mantine-color-gray-4), var(--mantine-color-dark-4))"
                  bgColor="light-dark(var(--mantine-color-gray-0), var(--mantine-color-dark-7))"
                />
              </ReactFlow>
            </ExplorationReadingContext.Provider>
          </DesignDocumentContext.Provider>
        )}
        {failure === null && exploration.elements.length > 0 && (
          <ExplorationPicker
            opened={picking}
            onOpened={setPicking}
            drawn={graph.elements.length}
            total={exploration.elements.length}
            document={document}
            isShown={isShown}
            onPick={onPick}
            onAddAll={() =>
              onShowAll(
                exploration.elements.map(({ id }) => id),
                true,
              )
            }
            onClear={() => setChoice(NOTHING_CHOSEN)}
          />
        )}
        {/* Down the canvas's left side: the visibility panel at the top,
            taking what room the shortcuts below it leave. */}
        <Box className={classes.side}>
          {seeing && (
            <VisibilityPanel
              relations={relations}
              onRelations={setRelations}
              sections={sections}
              veiled={veiled}
              onVeil={setVeiled}
              onClose={() => setSeeing(false)}
            />
          )}
          {pickable && failure === null && <ShortcutLegend />}
        </Box>
        <QuickAdd
          spot={quick?.spot ?? null}
          document={document}
          isDrawn={isShown}
          onClose={() => setQuick(null)}
          onPick={(id) => {
            const at = quick?.at;
            setQuick(null);
            // One drawn already is shown, not drawn twice.
            if (drawn.has(id)) return readAlone(id);
            if (at !== undefined) placeBeside(at);
            onShowAll([id], true);
          }}
        />
        {placing && nodes.length === 0 && failure === null && (
          <Text component="output" c="dimmed" p="lg" pos="absolute" top={0}>
            Placing the elements…
          </Text>
        )}
      </Box>
    </Stack>
  );
}

const NO_ROUTES: EdgeRoutes = new Map();

/**
 * The cards where the layout puts them, placed again whenever what is drawn
 * or how changes, or the reader asks; each placing is fitted to the canvas
 * once it lands. The layout's routes hold until a card is dragged.
 */
/** A change made from one card, to be placed beside it, not anew. */
interface LocalChange {
  /** The card it came from, or the point on the canvas it was asked for at. */
  anchor: string | CanvasPoint;
  /** The graph drawn when it was asked, so it holds for the next change only. */
  graph: ExplorationGraph | null;
}

function usePlacement(
  graph: ExplorationGraph,
  algorithm: LayoutAlgorithm,
  direction: LayoutDirection,
  /** Where the cards stood when the reader last left, to open at. */
  opening: { nodes: ExplorationNode[]; routes: EdgeRoutes } | null,
) {
  const [nodes, setNodes, onNodesMoved] = useNodesState<ExplorationNode>([]);
  const [routes, setRoutes] = useState<EdgeRoutes>(NO_ROUTES);
  const [asked, setAsked] = useState(0);
  const [placed, setPlaced] = useState<{
    graph: ExplorationGraph;
    algorithm: LayoutAlgorithm;
    direction: LayoutDirection;
    asked: number;
    /** Placed beside a card rather than anew, so the view stays where it is. */
    local: boolean;
  } | null>(null);
  // Read when the graph changes, without placing again when they do.
  const latest = useRef({ nodes, placed });
  useLayoutEffect(() => {
    latest.current = { nodes, placed };
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
    RelationEdge
  > | null>(null);
  // Cards glide to a new placing only just after it lands, never while one
  // is dragged — what a frame holds would trail behind it.
  const [gliding, setGliding] = useState(false);
  const timers = useRef<{
    gone?: ReturnType<typeof setTimeout>;
    glide?: ReturnType<typeof setTimeout>;
  }>({});
  useEffect(() => {
    const held = timers.current;
    return () => {
      clearTimeout(held.gone);
      clearTimeout(held.glide);
    };
  }, []);

  /** Cards where a placing, or a step gone back to, puts them. */
  const landNodes = useCallback(
    (next: ExplorationNode[], routes: EdgeRoutes) => {
      // A card taken off stays a moment, fading, before it is gone.
      setNodes((shown) => {
        const kept = new Set(next.map(({ id }) => id));
        const leaving = shown
          .filter(({ id }) => !kept.has(id))
          .map((node) => ({ ...node, data: { ...node.data, leaving: true } }));
        return [...next, ...leaving];
      });
      clearTimeout(timers.current.gone);
      timers.current.gone = setTimeout(
        () => setNodes((shown) => shown.filter(({ data }) => !data.leaving)),
        LEAVING_MS,
      );
      setGliding(true);
      clearTimeout(timers.current.glide);
      timers.current.glide = setTimeout(() => setGliding(false), GLIDE_MS);
      setRoutes(routes);
      setPlacements((count) => count + 1);
      setFailure(null);
    },
    [setNodes],
  );
  const land = useCallback(
    (elements: PlacedElement[], routes: EdgeRoutes, way: LayoutDirection) =>
      landNodes(
        elements.map((each) => nodeOf(each, way)),
        routes,
      ),
    [landNodes],
  );

  // A step gone back to, to be put back as it stood rather than placed.
  const restoring = useRef<{
    nodes: ExplorationNode[];
    routes: EdgeRoutes;
    /** Fitted to the canvas, as a diagram opened is; a step gone back to is not. */
    fit: boolean;
  } | null>(
    opening === null
      ? null
      : { nodes: opening.nodes, routes: opening.routes, fit: true },
  );
  /**
   * Puts the cards back where a step had them: now, when what is drawn is
   * as it was; else once the change back to it lands, in place of a placing.
   */
  const restore = useCallback(
    (nodes: ExplorationNode[], routes: EdgeRoutes, afterChange: boolean) => {
      if (afterChange) restoring.current = { nodes, routes, fit: false };
      else landNodes(nodes, routes);
    },
    [landNodes],
  );
  // How many times the reader moved a card or resized a frame by hand.
  const [edits, setEdits] = useState(0);
  const onNodeDragStop = useCallback(() => setEdits((count) => count + 1), []);

  useEffect(() => {
    let current = true;
    const done = (local: boolean) =>
      setPlaced({ graph, algorithm, direction, asked, local });

    // A step gone back to stands as it stood.
    const back = restoring.current;
    if (back !== null) {
      restoring.current = null;
      local.current = null;
      landNodes(back.nodes, back.routes);
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
      last.algorithm === algorithm &&
      last.direction === direction &&
      last.asked === asked
    ) {
      const elements = placeLocally(
        standingOf(latest.current.nodes),
        graph,
        change.anchor,
      );
      if (elements !== null) {
        land(elements, NO_ROUTES, direction);
        done(true);
        return;
      }
    }

    layoutExploration(graph, algorithm, direction).then(
      (placement) => {
        if (!current) return;
        land(placement.elements, placement.routes, direction);
        done(false);
      },
      (error: unknown) => {
        if (!current) return;
        setFailure(error instanceof Error ? error.message : String(error));
        done(false);
      },
    );
    return () => {
      current = false;
    };
  }, [graph, algorithm, direction, asked, land, landNodes]);

  /**
   * What a container holds placed anew inside it, from what is drawn now;
   * when that cannot be done without moving the rest, everything anew.
   */
  const arrange = useCallback(
    async (id: string) => {
      const drawn = latest.current.placed?.graph;
      // Only a container drawn round others has anything to arrange.
      if (
        drawn === undefined ||
        !drawn.elements.some(({ parent }) => parent === id)
      )
        return;
      const inside = await layoutWithin(drawn, id, algorithm, direction);
      if (latest.current.placed?.graph !== drawn) return;
      const elements = arrangeWithin(
        standingOf(latest.current.nodes),
        drawn,
        id,
        inside,
      );
      if (elements === null) setAsked((count) => count + 1);
      else land(elements, NO_ROUTES, direction);
    },
    [algorithm, direction, land],
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
    const frame = requestAnimationFrame(() => void flow.fitView(FIT));
    return () => cancelAnimationFrame(frame);
  }, [placed, flow]);

  // A card moved off its place, or a frame resized, leaves the routes made
  // for it behind.
  const onNodesChange = useCallback(
    (changes: NodeChange<ExplorationNode>[]) => {
      if (
        changes.some(
          (change) =>
            change.type === 'position' ||
            (change.type === 'dimensions' && change.resizing === true),
        )
      )
        setRoutes(NO_ROUTES);
      // A frame let go of after resizing is a step of its own.
      if (
        changes.some(
          (change) => change.type === 'dimensions' && change.resizing === false,
        )
      )
        setEdits((count) => count + 1);
      onNodesMoved(changes);
    },
    [onNodesMoved],
  );

  const placing =
    placed === null ||
    placed.graph !== graph ||
    placed.algorithm !== algorithm ||
    placed.direction !== direction ||
    placed.asked !== asked;
  return {
    nodes,
    routes,
    placements,
    onNodesChange,
    placing,
    failure,
    autoPlace: () => setAsked((count) => count + 1),
    placeBeside,
    arrange,
    gliding,
    restore,
    edits,
    onNodeDragStop,
    flow,
    setFlow,
  };
}

/**
 * Whether a key pressed there is meant for something else than the canvas:
 * typed into a field, or pressed in the picker, whose rows and boxes are
 * its own to tick.
 */
const isElsewhere = (target: EventTarget | null): boolean =>
  target instanceof HTMLElement &&
  (target.isContentEditable ||
    target instanceof HTMLInputElement ||
    target instanceof HTMLTextAreaElement ||
    target instanceof HTMLSelectElement ||
    target.closest('[role="tree"], [role="dialog"]') !== null);

/** Each card where the reader sees it now, dragged or resized or not. */
const standingOf = (nodes: ExplorationNode[]): PlacedElement[] =>
  nodes
    .filter(({ data }) => !data.leaving)
    .map(({ data, position, width, height }) => ({
      ...data.placed,
      ...position,
      width: width ?? data.placed.width,
      height: height ?? data.placed.height,
    }));

function nodeOf(
  placed: PlacedElement,
  direction: LayoutDirection,
): ExplorationNode {
  const { element } = placed;
  return {
    id: element.id,
    type: 'element',
    position: { x: placed.x, y: placed.y },
    width: placed.width,
    height: placed.height,
    // What a frame holds stays inside it, however it is dragged.
    ...(element.parent === null
      ? {}
      : { parentId: element.parent, extent: 'parent' as const }),
    data: { placed, direction },
  };
}

const RELATION_CLASS = {
  contains: classes.edge,
  isPartOf: `${classes.edge} ${classes.isPartOf}`,
  uses: `${classes.edge} ${classes.uses}`,
} as const;

const ARROW = {
  type: MarkerType.ArrowClosed,
  width: 16,
  height: 16,
};

function edgeOf(
  relation: DrawnRelation,
  {
    route,
    orthogonal,
    animated,
    highlight,
  }: Required<RelationEdge>['data'] & {
    animated: boolean;
    /** Where the edge stands to the selection; nothing with none in hand. */
    highlight: 'highlighted' | 'faded' | undefined;
  },
): RelationEdge {
  return {
    id: relation.id,
    type: 'relation',
    source: relation.source,
    target: relation.target,
    data: { route, orthogonal },
    animated,
    label: RELATION_WORD[relation.kind],
    className:
      highlight === undefined
        ? RELATION_CLASS[relation.kind]
        : `${RELATION_CLASS[relation.kind]} ${classes[highlight]}`,
    // The selection's relations are drawn over the rest.
    zIndex: highlight === 'highlighted' ? 1 : 0,
    labelStyle: { fontSize: 11, fill: 'var(--noesis-secondary-text)' },
    labelBgStyle: { fill: 'var(--mantine-color-body)' },
    labelBgPadding: [4, 2],
    markerEnd: {
      ...ARROW,
      color:
        highlight === 'highlighted'
          ? 'var(--noesis-architecture-selection)'
          : relation.kind === 'uses'
            ? 'var(--mantine-color-brand-filled)'
            : 'var(--noesis-architecture-edge)',
    },
  };
}
