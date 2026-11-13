import { Background, ReactFlow, ViewportPortal } from '@xyflow/react';
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  ChangeMarksContext,
  DesignDocumentContext,
  ElementPanel,
} from '#/features/design-docs/element-reader.ts';
import { byIdOf } from '#/shared/collections.ts';
import { Alert } from '#/shared/design-system/alert.tsx';
import { Box } from '#/shared/design-system/box.tsx';
import { useComputedColorScheme } from '#/shared/design-system/color-scheme.ts';
import { Stack } from '#/shared/design-system/stack.tsx';
import '@xyflow/react/dist/base.css';
import { Text } from '#/shared/design-system/text.tsx';
import { useDevToolsContext } from '#/shared/dev-tools/dev-tools-context.tsx';
import { DOT_GRID } from '#/shared/ui/diagram-canvas/canvas-background.ts';
import {
  CANVAS_FLOW,
  useCanvasZoom,
} from '#/shared/ui/diagram-canvas/canvas-flow.ts';
import {
  isElsewhere,
  useLetGoOnEscape,
} from '#/shared/ui/diagram-canvas/canvas-keys.ts';
import { selectionAfterClick } from '#/shared/ui/diagram-canvas/canvas-selection.ts';
import { DetailsDock } from '#/shared/ui/diagram-canvas/details-dock.tsx';
import { FIT } from '#/shared/ui/diagram-canvas/fit.ts';
import { FloatingEdgeView } from '#/shared/ui/diagram-canvas/floating-edge.tsx';
import { useEvenCtrlZoom } from '#/shared/ui/diagram-canvas/use-even-ctrl-zoom.ts';
import { ZoomControls } from '#/shared/ui/zoom-controls.tsx';
import type { SystemModel } from '#backend/app/system-model/system-model.ts';
import {
  choiceWithin,
  type ElementChoice,
  elementSectionsOf,
  explorationOf,
  graphOf,
  groupOf,
  hiddenBy,
  kindWordOf,
  neighboursOf,
  NOTHING_CHOSEN,
  pickedAll,
  type RelationKind,
  relatedToAll,
  removalOf,
} from '../../system-model-exploration.ts';
import { designOf } from '../../system-model.model.ts';
import { recallBadgeLook, rememberBadgeLook } from './badge-look.ts';
import { CanvasTooltips } from './canvas-tooltips.tsx';
import { ElementNode, type ExplorationNode } from './element-node.tsx';
import { edgeOf } from './exploration-edges.ts';
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
import { focusOn, PANEL_ROOM, RAISED_Z } from './exploration-timing.ts';
import { type Drawing, ExplorationToolbar } from './exploration-toolbar.tsx';
import { type CanvasPoint } from './place-locally.ts';
import { QuickAdd, type QuickAddSpot } from './quick-add.tsx';
import { ShortcutLegend } from './shortcut-legend.tsx';
import { DiagramThemeContext } from './themes/diagram-theme-context.ts';
import { useDiagramTheme } from './themes/use-diagram-theme.ts';
import { usePlacement } from './use-placement.ts';
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

const EDGE_TYPES = { relation: FloatingEdgeView };

/** How many steps the diagram keeps to go back through. */
const STEPS = 100;

const sameSet = (a: ReadonlySet<string>, b: ReadonlySet<string>) =>
  a.size === b.size && [...a].every((each) => b.has(each));

const NONE: ReadonlySet<string> = new Set();

const sameChoice = (a: ElementChoice, b: ElementChoice) =>
  sameSet(a.shown, b.shown) &&
  sameSet(a.picks.added, b.picks.added) &&
  sameSet(a.picks.removed, b.picks.removed) &&
  sameSet(a.picks.bySlot ?? NONE, b.picks.bySlot ?? NONE);

/** The one layout the reader is offered. */
const ALGORITHM = 'layered';

export function ExplorationView({ model }: { model: SystemModel }) {
  const {
    features: { animateEdgesWhileDragging },
  } = useDevToolsContext();
  const exploration = useMemo(() => explorationOf(model), [model]);
  const modelId = model.id;
  const neighbours = useMemo(() => neighboursOf(exploration), [exploration]);
  const elementsById = useMemo(
    () => byIdOf(exploration.elements),
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
    () =>
      opening?.relations ??
      new Set([
        'contains',
        'state',
        'collaborator',
        'input',
        'output',
        'invokes',
        'performs',
      ]),
  );
  const [drawing, setDrawing] = useState<Drawing>({
    direction: opening?.direction ?? 'vertical',
    // A new diagram draws slots on cards; one left as nodes opens so.
    slots: opening?.slots ?? 'cards',
    // How the edges were drawn when the diagram was left, as it is restored.
    orthogonal: opened?.edges?.orthogonal ?? true,
    animated: opened?.edges?.animated ?? true,
    look: recallBadgeLook(),
  });
  const { direction, slots, orthogonal, animated, look } = drawing;
  useEffect(() => rememberBadgeLook(look), [look]);
  // Chosen on the Dev Tools page; the exploration only draws in it.
  const theme = useDiagramTheme();
  const graph = useMemo(
    // The look sets the room each card makes for its badges.
    () => ({
      ...graphOf(exploration, { hidden, relations, picks, slots }),
      look,
    }),
    [exploration, hidden, relations, picks, slots, look],
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
    raised,
    outline,
    flow,
    setFlow,
  } = usePlacement(graph, ALGORITHM, direction, opening);
  const zoom = useCanvasZoom(flow);

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
      slots: how.slots,
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
        step.direction !== how.direction ||
        step.slots !== how.slots;
      stepping.current = true;
      restore(step.nodes, changes);
      if (!changes) return;
      setChoice(step.choice);
      setRelations(step.relations);
      setDrawing((was) => ({
        ...was,
        direction: step.direction,
        slots: step.slots,
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
  // edges go with it. A card dragged as it is goes over every other,
  // whichever frame it is in, and what it holds over it in turn: raised as a
  // node, not on the page, so the canvas raises what is inside with it.
  const visibleNodes = useMemo<ExplorationNode[]>(
    () =>
      veiled.size === 0 && raised === null
        ? nodes
        : nodes.map((node) =>
            veiled.has(groupOf(node.data.placed.element))
              ? { ...node, hidden: true }
              : node.id === raised
                ? { ...node, zIndex: RAISED_Z }
                : node,
          ),
    [nodes, veiled, raised],
  );
  const scheme = useComputedColorScheme('light');
  const document = useMemo(() => designOf(model), [model]);
  // In hand, in the order taken; the last is the one the panel reads.
  const [selection, setSelection] = useState<readonly string[]>([]);
  const selected = selection.at(-1) ?? null;
  const inHandSet = useMemo(() => new Set(selection), [selection]);
  // A card clicked is taken in hand, as on every canvas.
  const select = useCallback((id: string, adding: boolean) => {
    setSelection((held) => selectionAfterClick(held, id, adding));
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
  // Ctrl and the wheel zoom as gently as on every diagram.
  useEvenCtrlZoom(canvas);
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
  // On the diagram, as a card or as badges only: what a card's menu need
  // not offer to bring in. The picker offers a type drawn as badges only,
  // to bring out as a card of its own.
  const present = useMemo(
    () => new Set([...drawn, ...graph.folded]),
    [drawn, graph.folded],
  );
  const onShowAll = useCallback(
    (ids: readonly string[], shown: boolean, bySlot = false) =>
      setChoice((current) => {
        const kept = choiceWithin(current, exploration);
        return { ...kept, picks: pickedAll(kept.picks, ids, shown, bySlot) };
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
  // These cards brought into view, unless all are in sight already, the
  // panel a lone one is read in not over it.
  const showInSight = useCallback(
    (ids: readonly string[], alone: boolean) => {
      if (flow === null) return;
      const box = canvas.current?.getBoundingClientRect();
      const bounds = flow.getNodesBounds([...ids]);
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
    },
    [flow],
  );
  useEffect(() => {
    const focus = focusAfter.current;
    if (focus === null || gliding || flow === null) return;
    const ids =
      focus.from === null ? [...focus.ids] : [focus.from, ...focus.ids];
    const landed = new Set(nodes.map(({ id }) => id));
    if (!ids.every((id) => landed.has(id))) return;
    focusAfter.current = null;
    showInSight(ids, focus.ids.length === 1);
  }, [gliding, nodes, flow, showInSight]);
  // A card already drawn, gone to from elsewhere — a badge naming its type:
  // in hand alone, and in sight.
  const goToCard = useCallback(
    (id: string) => {
      setSelection([id]);
      showInSight([id], true);
    },
    [showInSight],
  );
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
      badges: graph.badges,
      look,
      slots: exploration.slots,
      onGoTo: goToCard,
      onSelect: select,
      onLetGo: () => {
        letGo();
        setQuick(null);
      },
      drawn: present,
      neighbours,
      elements: elementsById,
      onShow: (
        ids: readonly string[],
        shown: boolean,
        from: string,
        thenArrange = false,
        at?: CanvasPoint,
        bySlot = false,
      ) => {
        if (!shown) return remove(ids, from);
        placeBeside(at ?? from, thenArrange ? [from] : []);
        onShowAll(ids, shown, bySlot);
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
      graph.badges,
      look,
      exploration.slots,
      goToCard,
      select,
      letGo,
      present,
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
  // Escape lets go of the cards in hand, as on every diagram.
  useLetGoOnEscape(selection.length > 0, letGo);
  // Delete or Backspace takes every card in hand off the diagram, as their
  // crosses do.
  useEffect(() => {
    if (selection.length === 0) return;
    const onKey = (event: globalThis.KeyboardEvent) => {
      if (event.altKey || event.ctrlKey || event.metaKey) return;
      if (isElsewhere(event.target)) return;
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
        <ZoomControls quiet {...zoom.controls} />
      </ExplorationToolbar>
    ),
    [stepAt, undo, redo, seeing, veiled, drawing, autoPlace, zoom],
  );
  const selectionPanel = useMemo(
    () =>
      inHand === null ? null : (
        <DetailsDock
          folded={folded}
          onUnfold={() => setFolded(false)}
          subject={inHand.name}
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
        </DetailsDock>
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
    // The model as it stands: nothing on it is marked as a change.
    <ChangeMarksContext.Provider value={false}>
      {/* What floats over the canvas, in a portal, is drawn in its theme too. */}
      <DiagramThemeContext.Provider value={theme}>
        <Stack gap={0} flex={1} className={classes.exploration}>
          {toolbar}
          <Box
            ref={canvas}
            component="section"
            // A theme draws the canvas and what lies on it, never the toolbar
            // above: its stylesheet hangs its root here (themes/themes.ts).
            className={theme.className}
            data-diagram-theme={theme.id}
            pos="relative"
            flex={1}
            mih={0}
            aria-label="Exploration of the system model"
          >
            {failure !== null ? (
              <Alert
                color="red"
                title="The elements could not be placed"
                m="md"
              >
                {failure}
              </Alert>
            ) : exploration.elements.length === 0 ? (
              <Text c="dimmed" p="lg">
                The scan found no modules, building blocks or behaviors.
              </Text>
            ) : graph.elements.length === 0 ? (
              <Box h="100%" className={classes.blank} data-part="blank" />
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
                    {...CANVAS_FLOW}
                    minZoom={0.1}
                    maxZoom={2}
                    onInit={(instance) => {
                      setFlow(instance);
                      zoom.readZoom(instance);
                    }}
                    onMove={zoom.onMove}
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
                    // While a card is dragged, the edges' dashes hold still,
                    // unless dev tools ask for them to run on.
                    className={`${
                      placements % 2 === 0 ? classes.settled : classes.resettled
                    } ${gliding ? classes.gliding : ''} ${
                      dragging && !animateEdgesWhileDragging
                        ? classes.dragging
                        : ''
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
                    <Background {...(theme.background ?? DOT_GRID)} />
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
      </DiagramThemeContext.Provider>
    </ChangeMarksContext.Provider>
  );
}
