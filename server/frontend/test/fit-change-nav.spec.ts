import { describe, expect, it } from 'bun:test';
import {
  type ChangeNavWidths,
  fitChangeNav,
} from '../src/shell/navigation/fit-change-nav';

/** Overview, then Documents and Design docs with three and two items. */
function widths(
  row: number,
  open: [number, number, number] = [-1, -1, -1],
): ChangeNavWidths {
  return {
    row,
    fixed: 300,
    app: 200,
    appCompact: 80,
    more: 40,
    labelMenu: 24,
    groups: [
      { widths: [], open: open[0] },
      { widths: [100, 100, 100], open: open[1] },
      { widths: [100, 100], open: open[2] },
    ],
  };
}

describe('fitting the change bar', () => {
  it('shows every item when there is room', () => {
    // 300 + 200 + 300 + 200
    expect(fitChangeNav(widths(1000))).toEqual({
      shown: [[], [0, 1, 2], [0, 1]],
      compactApp: false,
    });
  });

  it('hides items from the end, behind a +N per group', () => {
    // One pixel short: the last design doc goes, and `+1` takes its place.
    expect(fitChangeNav(widths(999)).shown).toEqual([[], [0, 1, 2], [0]]);
  });

  it('keeps the open item to the last', () => {
    const { shown } = fitChangeNav(widths(700, [-1, 2, -1]));
    expect(shown[1]).toEqual([2]);
  });

  it('turns the labels into menus once not even the open item fits', () => {
    // 300 + 200 + two labels grown by 24 each
    expect(fitChangeNav(widths(548, [-1, 0, -1]))).toEqual({
      shown: [[], [], []],
      compactApp: false,
    });
  });

  it('drops the labels of the app links last', () => {
    expect(fitChangeNav(widths(400))).toEqual({
      shown: [[], [], []],
      compactApp: true,
    });
  });

  it('leaves a group with no items alone', () => {
    const empty = { ...widths(600), groups: [{ widths: [], open: -1 }] };
    expect(fitChangeNav(empty)).toEqual({ shown: [[]], compactApp: false });
  });
});
