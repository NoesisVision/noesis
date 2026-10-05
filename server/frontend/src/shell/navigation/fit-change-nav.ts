/** What the change bar measured, in pixels. */
export interface ChangeNavWidths {
  /** The bar itself: everything below has to fit in it. */
  row: number;
  /** What is always there: Overview, and each group's label. */
  fixed: number;
  /** System model and Dev tools with their labels, and as icons only. */
  app: number;
  appCompact: number;
  /** The `+N` after a group's items. */
  more: number;
  /** What a group's label gains once it is the menu for all its items. */
  labelMenu: number;
  /** Each group's items, one width per item, in order. */
  groups: { widths: number[]; open: number }[];
}

export interface ChangeNavFit {
  /** Per group, the indices of the items shown in the bar. */
  shown: number[][];
  /** System model and Dev tools as icons only. */
  compactApp: boolean;
}

function cost(widths: ChangeNavWidths, shown: number[][]): number {
  return widths.groups.reduce((total, group, g) => {
    const visible = shown[g] ?? [];
    const hidden = group.widths.length - visible.length;
    if (group.widths.length === 0) return total;
    if (visible.length === 0) return total + widths.labelMenu;
    const items = visible.reduce((sum, i) => sum + (group.widths[i] ?? 0), 0);
    return total + items + (hidden > 0 ? widths.more : 0);
  }, 0);
}

/**
 * Which items of each group fit in the bar beside their label.
 *
 * Items leave from the end — the last group's last item first — and the open
 * one stays to the last, so the page you are on is named in the bar for as
 * long as it fits. Once nothing but the open item is left and still does not
 * fit, every group's label becomes the menu of its items; and if even that is
 * too wide, System model and Dev tools give up their labels.
 */
export function fitChangeNav(widths: ChangeNavWidths): ChangeNavFit {
  const budget = widths.row - widths.fixed - widths.app;
  const shown = widths.groups.map((group) => group.widths.map((_, i) => i));

  while (cost(widths, shown) > budget) {
    const victim = lastHideable(widths, shown);
    if (!victim) break;
    const [g, at] = victim;
    shown[g]?.splice(at, 1);
  }
  if (cost(widths, shown) <= budget) return { shown, compactApp: false };

  const none = widths.groups.map(() => []);
  return {
    shown: none,
    compactApp: cost(widths, none) > budget,
  };
}

/** The last shown item that is not the open one, as `[group, position]`. */
function lastHideable(
  widths: ChangeNavWidths,
  shown: number[][],
): [number, number] | undefined {
  for (let g = shown.length - 1; g >= 0; g--) {
    const visible = shown[g] ?? [];
    for (let at = visible.length - 1; at >= 0; at--) {
      if (visible[at] !== widths.groups[g]?.open) return [g, at];
    }
  }
  return undefined;
}
