import { createReactComponent } from '@tabler/icons-react';

/*
 * Icons Tabler does not draw, made the way Tabler makes its own: the paths of
 * the `.svg` beside this file, handed to the same factory, so they take
 * `size`, `stroke` and `color` and sit on the same 24-unit grid as every
 * Tabler icon next to them. Change a drawing in its `.svg` and copy the paths
 * here; the spec fails while the two differ.
 */

/** Two chevrons pointing apart: open everything. */
export const IconChevronsUpDown = createReactComponent(
  'outline',
  'chevrons-up-down',
  'ChevronsUpDown',
  [
    ['path', { d: 'M8 8l4 -4l4 4', key: 'svg-0' }],
    ['path', { d: 'M8 16l4 4l4 -4', key: 'svg-1' }],
  ],
);

/** Two chevrons pointing together: close everything. */
export const IconChevronsDownUp = createReactComponent(
  'outline',
  'chevrons-down-up',
  'ChevronsDownUp',
  [
    ['path', { d: 'M8 4l4 4l4 -4', key: 'svg-0' }],
    ['path', { d: 'M8 20l4 -4l4 4', key: 'svg-1' }],
  ],
);

/** A broom: tidy up, setting out again what is there. */
export const IconBroom = createReactComponent('outline', 'broom', 'Broom', [
  ['path', { d: 'M12 3v7', key: 'svg-0' }],
  [
    'path',
    { d: 'M8 10h8a1 1 0 0 1 1 1v2h-10v-2a1 1 0 0 1 1 -1z', key: 'svg-1' },
  ],
  ['path', { d: 'M7 13l-2 8h14l-2 -8', key: 'svg-2' }],
  ['path', { d: 'M10 17l-0.5 4', key: 'svg-3' }],
  ['path', { d: 'M14 17l0.5 4', key: 'svg-4' }],
]);

/** A frame holding a card, crossed out: remove it with all it holds. */
export const IconFrameX = createReactComponent('outline', 'frame-x', 'FrameX', [
  [
    'path',
    {
      d: 'M13 20h-7a2 2 0 0 1 -2 -2v-12a2 2 0 0 1 2 -2h12a2 2 0 0 1 2 2v7',
      key: 'svg-0',
    },
  ],
  ['path', { d: 'M8 8h8v5h-8z', key: 'svg-1' }],
  ['path', { d: 'M17 17l4 4', key: 'svg-2' }],
  ['path', { d: 'M21 17l-4 4', key: 'svg-3' }],
]);
