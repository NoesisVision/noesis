import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { Box } from '#/shared/design-system/box.tsx';
import { Group } from '#/shared/design-system/group.tsx';
import { Modal } from '#/shared/design-system/modal.tsx';
import { VisuallyHidden } from '#/shared/design-system/visually-hidden.tsx';
import { useFullscreenRoot } from './use-fullscreen-root.ts';
import { ZoomControls } from './zoom-controls.tsx';
import classes from './mermaid-viewer.module.css';

export interface View {
  scale: number;
  x: number;
  y: number;
}

interface Size {
  width: number;
  height: number;
}

interface Point {
  x: number;
  y: number;
}

const MIN_SCALE = 0.1;
const MAX_SCALE = 8;
/** A small diagram fitted to a monitor would be all boxes and no context. */
const MAX_FIT_SCALE = 2;
/** What fitting leaves around the diagram, so its edges do not touch the frame. */
const FIT_SHARE = 0.95;
const BUTTON_STEP = 1.25;
/** How far an arrow key moves the picture, in screen pixels; Shift moves further. */
const KEY_STEP = 40;
const SHIFT_KEY_STEP = 200;
/** Which way each arrow key moves the view, as scrolling would. */
const KEY_DIRECTION: Readonly<Record<string, Point>> = {
  ArrowLeft: { x: 1, y: 0 },
  ArrowRight: { x: -1, y: 0 },
  ArrowUp: { x: 0, y: 1 },
  ArrowDown: { x: 0, y: -1 },
};

const clampScale = (scale: number) =>
  Math.min(MAX_SCALE, Math.max(MIN_SCALE, scale));

/** The whole picture, as large as the box allows, centred in it. */
export function fitView(picture: Size, box: Size): View {
  const scale = clampScale(
    Math.min(
      MAX_FIT_SCALE,
      (box.width / picture.width) * FIT_SHARE,
      (box.height / picture.height) * FIT_SHARE,
    ),
  );
  return centred(picture, box, scale);
}

/** The picture at the size mermaid drew it, centred in the box. */
export function actualView(picture: Size, box: Size): View {
  return centred(picture, box, 1);
}

function centred(picture: Size, box: Size, scale: number): View {
  return {
    scale,
    x: (box.width - picture.width * scale) / 2,
    y: (box.height - picture.height * scale) / 2,
  };
}

/** Scaled by `factor`, with what lies under `point` staying under it. */
export function zoomAt(view: View, factor: number, point: Point): View {
  const scale = clampScale(view.scale * factor);
  const change = scale / view.scale;
  return {
    scale,
    x: point.x - (point.x - view.x) * change,
    y: point.y - (point.y - view.y) * change,
  };
}

interface MermaidViewerProps {
  svg: string;
  name: string;
  opened: boolean;
  onClose: () => void;
}

/**
 * A drawn diagram over the whole screen, to be zoomed and dragged around: the
 * column a diagram sits in shrinks a wide one past reading.
 */
export function MermaidViewer({
  svg,
  name,
  opened,
  onClose,
}: MermaidViewerProps) {
  const root = useFullscreenRoot();

  // In full screen the browser takes Escape for itself and leaves full screen
  // before the dialog hears it, so the key meant to close the diagram takes
  // the page out of full screen instead. The diagram goes too: one press
  // should not need a second to finish what it was meant to do. Going into
  // full screen leaves it open.
  const shownIn = useRef(root);
  useEffect(() => {
    const left = shownIn.current !== null && root === null;
    shownIn.current = root;
    if (left) onClose();
  }, [root, onClose]);

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      fullScreen
      title={name}
      classNames={{
        root: classes.viewer,
        content: classes.content,
        body: classes.body,
      }}
    >
      <Canvas svg={svg} name={name} />
    </Modal>
  );
}

function Canvas({ svg, name }: { svg: string; name: string }) {
  const hint = useId();
  const frame = useRef<HTMLDivElement>(null);
  const picture = useRef<HTMLDivElement>(null);
  const size = useRef<Size>({ width: 1, height: 1 });
  const dragFrom = useRef<Point | null>(null);
  const [view, setView] = useState<View>({ scale: 1, x: 0, y: 0 });
  // React writes `innerHTML` again whenever this object is a new one, which
  // would parse the picture afresh on every step of a drag and undo the size
  // it is given below.
  const html = useMemo(() => ({ __html: svg }), [svg]);

  const boxOf = useCallback((): Size => {
    const element = frame.current;
    return element === null
      ? { width: 1, height: 1 }
      : { width: element.clientWidth, height: element.clientHeight };
  }, []);

  const fit = useCallback(
    () => setView(fitView(size.current, boxOf())),
    [boxOf],
  );

  // Mermaid sizes its SVG to the column it was drawn for; here it is given
  // back the size it was drawn at, and the scale does the rest.
  useLayoutEffect(() => {
    const drawn = picture.current?.querySelector('svg');
    if (drawn === null || drawn === undefined) return;
    const box = drawn.viewBox.baseVal;
    const measured =
      box !== null && box.width > 0 ? box : drawn.getBoundingClientRect();
    size.current = { width: measured.width, height: measured.height };
    drawn.setAttribute('width', String(measured.width));
    drawn.setAttribute('height', String(measured.height));
    drawn.style.maxWidth = 'none';
    fit();
  }, [svg, fit]);

  // React attaches wheel listeners as passive, and a passive one cannot stop
  // the page behind from scrolling, so this one is attached by hand.
  useEffect(() => {
    const element = frame.current;
    if (element === null) return;
    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      const bounds = element.getBoundingClientRect();
      // Firefox counts some wheels in lines; a line is about 16 pixels.
      const delta = event.deltaY * (event.deltaMode === 1 ? 16 : 1);
      // A trackpad pinch arrives as a wheel with Control held and small
      // deltas, so it is given more weight than a mouse wheel's notches.
      const factor = Math.exp(-delta * (event.ctrlKey ? 0.01 : 0.002));
      setView((current) =>
        zoomAt(current, factor, {
          x: event.clientX - bounds.left,
          y: event.clientY - bounds.top,
        }),
      );
    };
    element.addEventListener('wheel', onWheel, { passive: false });
    return () => element.removeEventListener('wheel', onWheel);
  }, []);

  const panBy = (by: Point) =>
    setView((current) => ({
      ...current,
      x: current.x + by.x,
      y: current.y + by.y,
    }));

  const zoomBy = (factor: number) => {
    const box = boxOf();
    setView((current) =>
      zoomAt(current, factor, { x: box.width / 2, y: box.height / 2 }),
    );
  };

  return (
    <>
      <Group justify="flex-end">
        <ZoomControls
          size="lg"
          zoom={view.scale}
          onZoomOut={() => zoomBy(1 / BUTTON_STEP)}
          onZoomIn={() => zoomBy(BUTTON_STEP)}
          onFit={fit}
          onActualSize={() => setView(actualView(size.current, boxOf()))}
        />
      </Group>
      <Box
        ref={frame}
        className={classes.canvas}
        // Not an `img`: the picture is an inline SVG document mounted below,
        // and an `img` cannot hold one. The role is what names it.
        // oxlint-disable-next-line jsx-a11y/prefer-tag-over-role
        role="img"
        aria-label={name}
        aria-describedby={hint}
        // Focusable so the arrow keys can move the picture as a drag does.
        tabIndex={0}
        onKeyDown={(event) => {
          const direction = KEY_DIRECTION[event.key];
          if (direction === undefined) return;
          event.preventDefault();
          const step = event.shiftKey ? SHIFT_KEY_STEP : KEY_STEP;
          panBy({ x: direction.x * step, y: direction.y * step });
        }}
        onPointerDown={(event) => {
          if (event.button !== 0) return;
          event.currentTarget.setPointerCapture(event.pointerId);
          dragFrom.current = { x: event.clientX, y: event.clientY };
        }}
        onPointerMove={(event) => {
          const from = dragFrom.current;
          if (from === null) return;
          dragFrom.current = { x: event.clientX, y: event.clientY };
          panBy({ x: event.clientX - from.x, y: event.clientY - from.y });
        }}
        onPointerUp={() => {
          dragFrom.current = null;
        }}
        onPointerCancel={() => {
          dragFrom.current = null;
        }}
      >
        <div
          ref={picture}
          className={classes.picture}
          style={{
            transform: `translate(${view.x}px, ${view.y}px) scale(${view.scale})`,
          }}
          // The same inline SVG document `MermaidDiagram` mounts; the canvas
          // around it carries the name.
          // oxlint-disable-next-line react/no-danger
          dangerouslySetInnerHTML={html}
        />
      </Box>
      <VisuallyHidden id={hint}>
        Drag, or use the arrow keys, to move around the diagram; hold Shift to
        move further.
      </VisuallyHidden>
    </>
  );
}
