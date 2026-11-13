import { type FitViewOptions } from '@xyflow/react';
import '@xyflow/react/dist/base.css';

/*
 * How fast the exploration moves, and the room it leaves: the glide of a
 * card dropped, the fade of one leaving, the room kept for the side panel.
 */

/** What the panel a card in hand is read in covers of the canvas, from its right: 360px, 16px in, and a gap. */
export const PANEL_ROOM = 420;

/**
 * Brought into view, what a card has just added and the card it came from:
 * gently, no closer than the cards' own size, and — when one was added,
 * read in the panel on the right — clear of that panel.
 */
export const focusOn = (alone: boolean): FitViewOptions => ({
  padding: alone ? { x: '64px', y: '64px', right: `${PANEL_ROOM}px` } : '64px',
  maxZoom: 1,
  duration: 400,
});

/** How long a card taken off the diagram takes to leave it. */
export const LEAVING_MS = 200;

/** How long the cards take to glide to where a new placing puts them. */
export const GLIDE_MS = 320;

/**
 * With `outlineDragForBigGroups` on in dev tools, the most cards, a group's
 * with all inside it, dragged as they are rather than as an outline.
 */
export const LIVE_DRAG = 10;

/** Where a card dragged as it is stands among the rest: over every one. */
export const RAISED_Z = 2000;
