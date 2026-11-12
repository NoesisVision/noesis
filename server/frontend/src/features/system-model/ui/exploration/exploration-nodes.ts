import { byIdOf } from '#/shared/collections.ts';
import '@xyflow/react/dist/base.css';
import { type ExplorationNode } from './element-node.tsx';
import {
  type LayoutDirection,
  type PlacedElement,
} from './layout-exploration.ts';
import { type CanvasPoint } from './place-locally.ts';
import classes from './exploration.module.css';

/*
 * The exploration's cards as React Flow holds them: built from where each
 * is placed, and read back for where each stands.
 */

/** A card being dragged: what is greyed, and the outline's size and start. */
export interface HeldCard {
  id: string;
  width: number;
  height: number;
  at: CanvasPoint;
}

/** Whether a node lands where, and as, it already stood. */
export const standsAsBefore = (was: ExplorationNode, node: ExplorationNode) =>
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
export function absoluteOf(nodes: ExplorationNode[], id: string): CanvasPoint {
  const byId = byIdOf(nodes);
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
export function descendantsOf(nodes: ExplorationNode[], id: string): string[] {
  return nodes
    .filter(({ parentId }) => parentId === id)
    .flatMap(({ id: kid }) => [kid, ...descendantsOf(nodes, kid)]);
}

/** Each card where the reader sees it now, dragged or not. */
export const standingOf = (nodes: ExplorationNode[]): PlacedElement[] =>
  nodes
    .filter(({ data }) => !data.leaving)
    .map(({ data, position, width, height }) => ({
      ...data.placed,
      ...position,
      width: width ?? data.placed.width,
      height: height ?? data.placed.height,
    }));

/** Where a frame is taken to be dragged: its top, by its name. */
/** The canvas behind the diagram, unless its theme draws its own. */
const FRAME_HANDLE = `.${classes.frameTop}`;

/** A node dragged as its kind is: a frame by its top, a card anywhere. */
export const withHandle = (node: ExplorationNode): ExplorationNode =>
  node.data.placed.holds === (node.dragHandle === FRAME_HANDLE)
    ? node
    : {
        ...node,
        dragHandle: node.data.placed.holds ? FRAME_HANDLE : undefined,
      };

export function nodeOf(
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
