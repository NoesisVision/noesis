/*
 * The canvas's own geometry, in pixels of the canvas (not of the screen):
 * where a point is, and the box a card or a frame takes.
 */

export interface Point {
  x: number;
  y: number;
}

export interface Rect extends Point {
  width: number;
  height: number;
}

/** Whether a point falls inside a rect, its border included. */
export const encloses = (rect: Rect, { x, y }: Point): boolean =>
  x >= rect.x &&
  x <= rect.x + rect.width &&
  y >= rect.y &&
  y <= rect.y + rect.height;
