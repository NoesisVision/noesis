import { IconListDetails } from '@tabler/icons-react';
import '@xyflow/react/dist/base.css';
import {
  Background,
  BackgroundVariant,
  MarkerType,
  type FitViewOptions,
  type NodeChange,
  type OnNodeDrag,
  Panel,
  ReactFlow,
  type ReactFlowInstance,
  useNodesState,
  ViewportPortal,
} from '@xyflow/react';
import {
  type CSSProperties,
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
import { ActionIcon } from '#/shared/design-system/action-icon.tsx';
import { Alert } from '#/shared/design-system/alert.tsx';
import { Box } from '#/shared/design-system/box.tsx';
import { useComputedColorScheme } from '#/shared/design-system/color-scheme.ts';
import { Stack } from '#/shared/design-system/stack.tsx';
import { Text } from '#/shared/design-system/text.tsx';
import { Tooltip } from '#/shared/design-system/tooltip.tsx';
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
  relatedToAll,
  removalOf,
} from '../../system-model-exploration.ts';
import { designOf } from '../../system-model.model.ts';
import { CanvasTooltips } from './canvas-tooltips.tsx';
import { ElementNode, type ExplorationNode } from './element-node.tsx';
import { recallChoice, rememberChoice } from './exploration-memory.ts';
import { ExplorationPicker } from './exploration-picker.tsx';
import {
  type ExplorationReading,
  ExplorationReadingContext,
  pathTo,
} from './exploration-reading.ts';
import {
  type DiagramStep,
  type DiagramSteps,
  recallSteps,
  rememberSteps,
} from './exploration-steps.ts';
import { type Drawing, ExplorationToolbar } from './exploration-toolbar.tsx';
import {
  type LayoutAlgorithm,
  type LayoutDirection,
  layoutExploration,
  layoutWithin,
  type PlacedElement,
} from './layout-exploration.ts';
import {
  arrangeWithin,
  type CanvasRect,
  landsIn,
  movedTo,
  refusingFrames,
  type CanvasPoint,
  placeLocally,
} from './place-locally.ts';
import { QuickAdd, type QuickAddSpot } from './quick-add.tsx';
import { EDGE_COLOR } from './relation-colors.ts';
import { type RelationEdge, RelationEdgeView } from './relation-edge.tsx';
import { ShortcutLegend } from './shortcut-legend.tsx';
import { VisibilityPanel } from './visibility-panel.tsx';
import classes from './exploration.module.css';

/*
 * The scanned model drawn as a diagram: its elements as cards, the relations
 * the scan holds between them as edges, and containment as cards inside
 * cards. The reader picks what is drawn and how it is placed; the layout
 * places it, and the reader may drag a card on from there until the next
 * auto-place puts everything back. A card chosen is read in a panel on the
 * canvas, its relations and what they join it to marked on the diagram;
 * hovered, a card says what its element is, as the model's tooltips do.
 */

const NODE_TYPES = { element: ElementNode };
const EDGE_TYPES = { relation: RelationEdgeView };
const FIT = { padding: 0.08 };
/** What the panel a card in hand is read in covers of the canvas, from its right: 360px, 16px in, and a gap. */
const PANEL_ROOM = 420;
/**
 * Brought into view, what a card has just added and the card it came from:
 * gently, no closer than the cards' own size, and — when one was added,
 * read in the panel on the right — clear of that panel.
 */
const focusOn = (alone: boolean): FitViewOptions => ({
  padding: alone ? { x: '64px', y: '64px', right: `${PANEL_ROOM}px` } : '64px',
  maxZoom: 1,
  duration: 400,
});
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
/** The most cards, a group's with all inside it, dragged as they are rather than as an outline. */
const LIVE_DRAG = 10;
/** The one layout the reader is offered. */
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
    () => opening?.relations ?? new Set(['contains', 'uses', 'invokes']),
  );
  const [drawing, setDrawing] = useState<Drawing>({
    direction: opening?.direction ?? 'vertical',
    // How the edges were drawn when the diagram was left, as it is restored.
    orthogonal: opened?.edges?.orthogonal ?? true,
    animated: opened?.edges?.animated ?? true,
  });
  const { direction, orthogonal, animated } = drawing;
  const graph = useMemo(
    () => graphOf(exploration, { hidden, relations, picks }),
    [exploration, hidden, relations, picks],
  );

  const {
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
    held: dragged,
    dragging,
    outline,
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
  const now = useRef({ stored, relations, drawing, nodes });
  useLayoutEffect(() => {
    now.current = { stored, relations, drawing, nodes };
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
      direction: how.direction,
      nodes: now.current.nodes.filter(({ data }) => !data.leaving),
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
        step.direction !== how.direction;
      stepping.current = true;
      restore(step.nodes, changes);
      if (!changes) return;
      setChoice(step.choice);
      setRelations(step.relations);
      setDrawing((was) => ({
        ...was,
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
  const visibleNodes = useMemo<ExplorationNode[]>(
    () =>
      veiled.size === 0 && dragged === null
        ? nodes
        : nodes.map((node) =>
            veiled.has(groupOf(node.data.placed.element))
              ? { ...node, hidden: true }
              : dragged?.ids.has(node.id) === true
                ? // Greyed where it stands while its outline is dragged.
                  { ...node, className: classes.held }
                : node,
          ),
    [nodes, veiled, dragged],
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
  // The panel a lone card is read in, minimized: it shrinks into its corner,
  // where a button opens it again. Kept so as the hand changes.
  const [folded, setFolded] = useState(false);
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
  // What was just added — from a card's menu, the picker or the canvas's own
  // menu — with the card it came from, if any: in hand at once, and, once the
  // cards have landed and settled where they go, brought into view — unless
  // all are in sight already, the panel not over a lone one.
  const focusAfter = useRef<{
    ids: readonly string[];
    from: string | null;
  } | null>(null);
  const bringIn = useCallback(
    (ids: readonly string[], from: string | null = null) => {
      const added = ids.filter((id) => !drawn.has(id));
      if (added.length === 0) return;
      focusAfter.current = { ids: added, from };
      setSelection(added);
    },
    [drawn],
  );
  useEffect(() => {
    const focus = focusAfter.current;
    if (focus === null || gliding || flow === null) return;
    const ids =
      focus.from === null ? [...focus.ids] : [focus.from, ...focus.ids];
    const landed = new Set(nodes.map(({ id }) => id));
    if (!ids.every((id) => landed.has(id))) return;
    focusAfter.current = null;
    const alone = focus.ids.length === 1;
    const box = canvas.current?.getBoundingClientRect();
    const bounds = flow.getNodesBounds(ids);
    const start = flow.flowToScreenPosition(bounds);
    const end = flow.flowToScreenPosition({
      x: bounds.x + bounds.width,
      y: bounds.y + bounds.height,
    });
    const inSight =
      box !== undefined &&
      start.x >= box.left &&
      start.y >= box.top &&
      end.x <= box.right - (alone ? PANEL_ROOM : 0) &&
      end.y <= box.bottom;
    if (inSight) return;
    void flow.fitView({
      ...focusOn(alone),
      nodes: ids.map((id) => ({ id })),
    });
  }, [gliding, nodes, flow]);
  // A row of the picker, clicked again and again: the element alone, then
  // it and all inside it, then none of them.
  const onPick = useCallback(
    (id: string) => {
      const inside = insideOf(id);
      if (!drawn.has(id)) {
        onShowAll([id], true);
        bringIn([id]);
      } else if (inside.some((each) => !drawn.has(each))) {
        onShowAll([id, ...inside], true);
        bringIn(inside, id);
      } else onShowAll([id, ...inside], false);
    },
    [insideOf, drawn, onShowAll, bringIn],
  );
  /**
   * Takes these off the diagram from a card, and all drawn inside them, and
   * lets go of what went.
   */
  const remove = useCallback(
    (ids: readonly string[], from: string, alone = false) => {
      // Alone, a container goes and what it held stays where it stands.
      const gone = alone ? [...ids] : removalOf(graph, ids);
      // What stays stands where it is; the container a group leaves keeps
      // its size and its cards their places.
      placeBeside(from);
      onShowAll(gone, false);
      setSelection((held) => held.filter((id) => !gone.includes(id)));
    },
    [graph, placeBeside, onShowAll],
  );
  const reading = useMemo<ExplorationReading>(
    () => ({
      selected: inHandSet,
      related: related.elements,
      path: pathTo(inHandSet, elementsById),
      onSelect: select,
      onLetGo: () => {
        letGo();
        setQuick(null);
      },
      drawn,
      neighbours,
      elements: elementsById,
      onShow: (
        ids: readonly string[],
        shown: boolean,
        from: string,
        thenArrange = false,
        at?: CanvasPoint,
      ) => {
        if (!shown) return remove(ids, from);
        placeBeside(at ?? from, thenArrange ? [from] : []);
        onShowAll(ids, shown);
        bringIn(ids, from);
      },
      onDraw: (relation) =>
        setRelations((current) =>
          current.has(relation) ? current : new Set([...current, relation]),
        ),
      onArrange: (id: string) => void arrange(id),
      onRemoveAlone: (id: string) => remove([id], id, true),
    }),
    [
      inHandSet,
      related,
      select,
      letGo,
      drawn,
      neighbours,
      elementsById,
      remove,
      placeBeside,
      onShowAll,
      bringIn,
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
    [graph, orthogonal, animated, selection, related],
  );

  /*
   * What lies round the canvas is made once for what it shows, so a card
   * dragged, which draws the view again on each move, draws none of it.
   */
  const toolbar = useMemo(
    () => (
      <ExplorationToolbar
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
          quiet
          zoom={zoom}
          disabled={flow === null}
          onZoomOut={() => void flow?.zoomOut()}
          onZoomIn={() => void flow?.zoomIn()}
          onFit={() => void flow?.fitView(FIT)}
        />
      </ExplorationToolbar>
    ),
    [stepAt, undo, redo, seeing, veiled, drawing, autoPlace, zoom, flow],
  );
  const selectionPanel = useMemo(
    () =>
      inHand === null ? null : (
        // The panel and, in its corner, the button it shrinks into: both
        // always there, so each grows or shrinks into the other.
        <Panel
          position="top-right"
          className={`nowheel nopan ${classes.selectionDock}`}
          data-folded={folded || undefined}
        >
          {/* Its own scroll and clicks: a wheel over it reads on rather than zooms. */}
          <section
            aria-label="Selection"
            className={classes.selection}
            inert={folded}
          >
            <ElementPanel
              key={inHand.id}
              id={inHand.id}
              document={document}
              eyebrow={kindWordOf(inHand)}
              title={inHand.name}
              onSelectElement={readAlone}
              onMinimize={() => setFolded(true)}
            />
          </section>
          <Tooltip label={`Show the details of ${inHand.name}`} position="left">
            <ActionIcon
              variant="default"
              size={44}
              className={classes.selectionIcon}
              aria-label={`Show the details of ${inHand.name}`}
              aria-expanded={false}
              inert={!folded}
              onClick={() => setFolded(false)}
            >
              <IconListDetails size={20} stroke={1.7} aria-hidden />
            </ActionIcon>
          </Tooltip>
        </Panel>
      ),
    [inHand, document, readAlone, folded],
  );
  const addAll = useCallback(() => {
    const all = exploration.elements.map(({ id }) => id);
    onShowAll(all, true);
    bringIn(all);
  }, [onShowAll, bringIn, exploration]);
  const clear = useCallback(() => setChoice(NOTHING_CHOSEN), []);
  const picker = useMemo(
    () => (
      <ExplorationPicker
        opened={picking}
        onOpened={setPicking}
        drawn={graph.elements.length}
        total={exploration.elements.length}
        document={document}
        isShown={isShown}
        onPick={onPick}
        onAddAll={addAll}
        onClear={clear}
      />
    ),
    [picking, graph, exploration, document, isShown, onPick, addAll, clear],
  );
  const closeVisibility = useCallback(() => setSeeing(false), []);
  const side = useMemo(
    () => (
      <>
        {seeing && (
          <VisibilityPanel
            relations={relations}
            onRelations={setRelations}
            sections={sections}
            veiled={veiled}
            onVeil={setVeiled}
            onClose={closeVisibility}
          />
        )}
        {pickable && failure === null && <ShortcutLegend />}
      </>
    ),
    [seeing, relations, sections, veiled, closeVisibility, pickable, failure],
  );
  const closeQuick = useCallback(() => setQuick(null), []);
  const quickAdd = useMemo(
    () => (
      <QuickAdd
        spot={quick?.spot ?? null}
        document={document}
        isDrawn={isShown}
        onClose={closeQuick}
        onPick={(id) => {
          const at = quick?.at;
          setQuick(null);
          // One drawn already is shown, not drawn twice.
          if (drawn.has(id)) return readAlone(id);
          if (at !== undefined) placeBeside(at);
          onShowAll([id], true);
          bringIn([id]);
        }}
      />
    ),
    [
      quick,
      document,
      isShown,
      closeQuick,
      drawn,
      readAlone,
      placeBeside,
      onShowAll,
      bringIn,
    ],
  );

  return (
    <Stack gap={0} flex={1} className={classes.exploration}>
      {toolbar}
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
                onNodeDragStart={onNodeDragStart}
                onNodeDrag={onNodeDrag}
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
                // While a card is dragged, the edges' dashes hold still.
                className={`${
                  placements % 2 === 0 ? classes.settled : classes.resettled
                } ${gliding ? classes.gliding : ''} ${
                  dragging ? classes.dragging : ''
                }`}
              >
                {selectionPanel}
                {dragged !== null && (
                  <ViewportPortal>
                    <div
                      ref={outline}
                      aria-hidden
                      className={classes.outline}
                      style={{
                        width: dragged.width,
                        height: dragged.height,
                        transform: `translate(${dragged.at.x}px, ${dragged.at.y}px)`,
                      }}
                    />
                  </ViewportPortal>
                )}
                <Background
                  variant={BackgroundVariant.Dots}
                  gap={20}
                  size={1}
                  color="light-dark(var(--mantine-color-gray-3), var(--mantine-color-dark-4))"
                  bgColor="light-dark(var(--mantine-color-gray-0), var(--mantine-color-dark-7))"
                />
              </ReactFlow>
              <CanvasTooltips within={canvas} dragging={dragging} />
            </ExplorationReadingContext.Provider>
          </DesignDocumentContext.Provider>
        )}
        {failure === null && exploration.elements.length > 0 && picker}
        {/* Down the canvas's left side: the visibility panel at the top,
            taking what room the shortcuts below it leave. */}
        <Box className={classes.side}>{side}</Box>
        {quickAdd}
        {placing && nodes.length === 0 && failure === null && (
          <Text component="output" c="dimmed" p="lg" pos="absolute" top={0}>
            Placing the elements…
          </Text>
        )}
      </Box>
    </Stack>
  );
}

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

function usePlacement(
  graph: ExplorationGraph,
  algorithm: LayoutAlgorithm,
  direction: LayoutDirection,
  /** Where the cards stood when the reader last left, to open at. */
  opening: { nodes: ExplorationNode[] } | null,
) {
  const [nodes, setNodes, onNodesMoved] = useNodesState<ExplorationNode>([]);
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
    (next: ExplorationNode[]) => {
      // A card taken off stays a moment, fading, before it is gone.
      setNodes((shown) => {
        const kept = new Set(next.map(({ id }) => id));
        const leaving = shown
          .filter(({ id }) => !kept.has(id))
          .map((node) => ({ ...node, data: { ...node.data, leaving: true } }));
        // A card that stands as it stood stays the same node, so React Flow
        // draws only those that moved.
        const before = new Map(shown.map((node) => [node.id, node]));
        const landed = next.map((given) => {
          // A frame, saved before frames were taken by their top, is too.
          const node = withHandle(given);
          const was = before.get(node.id);
          return was !== undefined && standsAsBefore(was, node) ? was : node;
        });
        return [...landed, ...leaving];
      });
      clearTimeout(timers.current.gone);
      timers.current.gone = setTimeout(
        () => setNodes((shown) => shown.filter(({ data }) => !data.leaving)),
        LEAVING_MS,
      );
      setGliding(true);
      clearTimeout(timers.current.glide);
      timers.current.glide = setTimeout(() => setGliding(false), GLIDE_MS);
      setPlacements((count) => count + 1);
      setFailure(null);
    },
    [setNodes],
  );
  const land = useCallback(
    (elements: PlacedElement[], way: LayoutDirection) =>
      landNodes(elements.map((each) => nodeOf(each, way))),
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
  // How many times the reader moved a card where nothing else needed to
  // follow it.
  const [edits, setEdits] = useState(0);

  /*
   * A big group dragged stays where it stands, greyed, while an outline of
   * its size follows the pointer — moved on the page directly, so nothing
   * is drawn again on the way — and goes where the outline is let go of. A
   * card, or a group of a few, is light enough to move as it is dragged.
   * Either way its container is fitted round it once it is let go of.
   */
  const [held, setHeld] = useState<HeldCard | null>(null);
  // Any card in hand, big or small, so the cards' tooltips stay shut.
  const [dragging, setDragging] = useState(false);
  const outline = useRef<HTMLDivElement>(null);
  const holding = useRef<{
    id: string;
    origin: CanvasPoint;
    /** Where it stood when taken, relative to its container. */
    start: CanvasPoint;
    /** Moved as it is dragged, with no outline. */
    live: boolean;
    /** The modules it may not land in, for its outline to say so. */
    refusing: readonly CanvasRect[];
    size: { width: number; height: number };
  } | null>(null);
  const onNodeDragStart = useCallback<OnNodeDrag<ExplorationNode>>(
    (_, node) => {
      const shown = latest.current.nodes;
      const origin =
        node.parentId === undefined
          ? { x: 0, y: 0 }
          : absoluteOf(shown, node.parentId);
      setDragging(true);
      const ids = new Set([node.id, ...descendantsOf(shown, node.id)]);
      const live = ids.size <= LIVE_DRAG;
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
        refusing,
        size: {
          width: node.measured?.width ?? node.width ?? 0,
          height: node.measured?.height ?? node.height ?? 0,
        },
      };
      if (live) return;
      setHeld({
        id: node.id,
        ids,
        width: node.measured?.width ?? node.width ?? 0,
        height: node.measured?.height ?? node.height ?? 0,
        at: { x: origin.x + node.position.x, y: origin.y + node.position.y },
      });
    },
    [],
  );
  const onNodeDrag = useCallback<OnNodeDrag<ExplorationNode>>((_, node) => {
    const now = holding.current;
    const shown = outline.current;
    if (now === null || now.live || shown === null) return;
    const x = now.origin.x + node.position.x;
    const y = now.origin.y + node.position.y;
    shown.style.transform = `translate(${x}px, ${y}px)`;
    // Over another module the outline says it will not go in: marked on
    // the page directly, so nothing is drawn again.
    const refused = landsIn(now.refusing, { x, y, ...now.size });
    if (refused !== (shown.dataset.refused !== undefined))
      shown.toggleAttribute('data-refused', refused);
  }, []);
  const onNodeDragStop = useCallback<OnNodeDrag<ExplorationNode>>(
    (_, node) => {
      const now = holding.current;
      holding.current = null;
      setHeld(null);
      setDragging(false);
      if (now === null) return;
      const shown = latest.current.nodes;
      if (now.start.x === node.position.x && now.start.y === node.position.y)
        return;
      const drawn = latest.current.placed?.graph;
      const elements =
        drawn === undefined
          ? null
          : movedTo(standingOf(shown), drawn, node.id, {
              x: now.origin.x + node.position.x,
              y: now.origin.y + node.position.y,
            });
      if (elements !== null) return land(elements, direction);
      // No settling what it pushes: the card alone where it was let go.
      setNodes((all) =>
        all.map((each) =>
          each.id === node.id ? { ...each, position: node.position } : each,
        ),
      );
      setEdits((count) => count + 1);
    },
    [land, direction, setNodes],
  );

  // What was last placed, known at once rather than on the next render: run
  // again with nothing changed — as React runs it twice on mounting in
  // development — the effect leaves the cards where they stand, so a
  // diagram opened where it was left is not placed anew over it.
  const settled = useRef<{
    graph: ExplorationGraph;
    algorithm: LayoutAlgorithm;
    direction: LayoutDirection;
    asked: number;
  } | null>(null);
  useEffect(() => {
    const was = settled.current;
    if (
      was !== null &&
      was.graph === graph &&
      was.algorithm === algorithm &&
      was.direction === direction &&
      was.asked === asked
    )
      return;
    let current = true;
    const done = (local: boolean) => {
      settled.current = { graph, algorithm, direction, asked };
      setPlaced({ graph, algorithm, direction, asked, local });
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
        land(elements, direction);
        done(true);
        return;
      }
    }

    layoutExploration(graph, algorithm, direction).then(
      (placement) => {
        if (!current) return;
        land(placement.elements, direction);
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
      else land(elements, direction);
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
    placed === null ||
    placed.graph !== graph ||
    placed.algorithm !== algorithm ||
    placed.direction !== direction ||
    placed.asked !== asked;
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
    outline,
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

/** A card being dragged: what is greyed, and the outline's size and start. */
interface HeldCard {
  id: string;
  /** It and all drawn inside it, greyed where they stand. */
  ids: ReadonlySet<string>;
  width: number;
  height: number;
  at: CanvasPoint;
}

/** Whether a node lands where, and as, it already stood. */
const standsAsBefore = (was: ExplorationNode, node: ExplorationNode) =>
  was.data.leaving !== true &&
  was.position.x === node.position.x &&
  was.position.y === node.position.y &&
  was.width === node.width &&
  was.height === node.height &&
  was.parentId === node.parentId &&
  was.data.direction === node.data.direction &&
  was.data.placed.holds === node.data.placed.holds &&
  was.data.placed.element === node.data.placed.element &&
  was.dragHandle === node.dragHandle;

/** Where a card stands on the canvas, through each container round it. */
function absoluteOf(nodes: ExplorationNode[], id: string): CanvasPoint {
  const byId = new Map(nodes.map((node) => [node.id, node]));
  let x = 0;
  let y = 0;
  for (let node = byId.get(id); node !== undefined;) {
    x += node.position.x;
    y += node.position.y;
    node = node.parentId === undefined ? undefined : byId.get(node.parentId);
  }
  return { x, y };
}

/** Every card drawn inside this one, all the way down. */
function descendantsOf(nodes: ExplorationNode[], id: string): string[] {
  return nodes
    .filter(({ parentId }) => parentId === id)
    .flatMap(({ id: kid }) => [kid, ...descendantsOf(nodes, kid)]);
}

/** Each card where the reader sees it now, dragged or not. */
const standingOf = (nodes: ExplorationNode[]): PlacedElement[] =>
  nodes
    .filter(({ data }) => !data.leaving)
    .map(({ data, position, width, height }) => ({
      ...data.placed,
      ...position,
      width: width ?? data.placed.width,
      height: height ?? data.placed.height,
    }));

/** Where a frame is taken to be dragged: its top, by its name. */
const FRAME_HANDLE = `.${classes.frameTop}`;

/** A node dragged as its kind is: a frame by its top, a card anywhere. */
const withHandle = (node: ExplorationNode): ExplorationNode =>
  node.data.placed.holds === (node.dragHandle === FRAME_HANDLE)
    ? node
    : {
        ...node,
        dragHandle: node.data.placed.holds ? FRAME_HANDLE : undefined,
      };

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
    // What a frame holds is drawn inside it; dragged out, the frame grows.
    ...(element.parent === null ? {} : { parentId: element.parent }),
    // A frame is dragged by its top alone; a card, from anywhere on it.
    ...(placed.holds ? { dragHandle: FRAME_HANDLE } : {}),
    data: { placed, direction },
  };
}

const ARROW = {
  type: MarkerType.ArrowClosed,
  width: 16,
  height: 16,
};

function edgeOf(
  relation: DrawnRelation,
  {
    orthogonal,
    animated,
    highlight,
  }: Pick<Required<RelationEdge>['data'], 'orthogonal'> & {
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
    data: { orthogonal },
    animated,
    label: RELATION_WORD[relation.kind],
    className:
      highlight === undefined
        ? classes.edge
        : `${classes.edge} ${classes[highlight]}`,
    style: { '--relation-color': EDGE_COLOR[relation.kind] } as CSSProperties,
    // The selection's relations are drawn over the rest.
    zIndex: highlight === 'highlighted' ? 1 : 0,
    // A small pill on the line, its word in the relation's colour
    // (exploration.module.css draws the rest).
    labelBgPadding: [7, 3],
    labelBgBorderRadius: 8,
    markerEnd: {
      ...ARROW,
      color:
        highlight === 'highlighted'
          ? 'var(--mantine-color-brand-6)'
          : EDGE_COLOR[relation.kind],
    },
  };
}
