import { IconLayoutSidebarLeftExpand, IconSearch } from '@tabler/icons-react';
import {
  type ReactNode,
  type RefObject,
  useCallback,
  useEffect,
  useMemo,
  useRef,
} from 'react';
import { flushSync } from 'react-dom';
import { ActionIcon } from '#/shared/design-system/action-icon.tsx';
import { Box } from '#/shared/design-system/box.tsx';
import {
  useLocalStorage,
  useMediaQuery,
} from '#/shared/design-system/hooks.ts';
import { Splitter } from '#/shared/design-system/splitter.tsx';
import { Stack } from '#/shared/design-system/stack.tsx';
import { Tooltip } from '#/shared/design-system/tooltip.tsx';
import {
  isTreeShortcut,
  TREE_SHORTCUT,
  type TreeFold,
  TreeFoldContext,
} from './tree-fold.tsx';
import classes from './columns.module.css';

/** How the two columns were last left, which is not about any one document. */
const COLUMNS_KEY = 'noesis.designDocs.columns';
/** Whether the reader put the tree away, which holds for every document. */
const TREE_HIDDEN_KEY = 'noesis.designDocs.treeHidden';
const DEFAULT_COLUMNS = [38, 62];
/** The width the shell folds its sidebar at, past which two columns fit. */
const WIDE = '(min-width: 62em)';

/**
 * The frame every pane of the page is drawn in, for a detail that draws its
 * own panes side by side (`detailFrames`) to draw them as the tree's is.
 */
export const PANE_FRAME = classes.pane;

/**
 * Whether the page has room for its columns side by side; under it they stack
 * and the page scrolls as one.
 */
export const useWideColumns = () => useMediaQuery(WIDE, true);

/**
 * A width left in storage by another version of the app must not decide how a
 * page is laid out, so anything that is not a set of shares like `defaults`
 * reads as `defaults`. Parsing is the one throwing call, and it is kept to
 * this helper.
 */
function toShares(stored: string | undefined, defaults: number[]): number[] {
  try {
    const parsed: unknown = stored === undefined ? null : JSON.parse(stored);
    const valid =
      Array.isArray(parsed) &&
      parsed.length === defaults.length &&
      parsed.every(
        (share) => typeof share === 'number' && share > 0 && share < 100,
      );
    if (valid) return parsed as number[];
  } catch {
    // Unreadable is the same as absent.
  }
  return defaults;
}

/**
 * How a splitter's panes were last left, as percentage shares, kept under
 * `key`: a layout the reader chose, not one any document decides.
 */
export function useStoredShares(key: string, defaults: number[]) {
  return useLocalStorage<number[]>({
    key,
    defaultValue: defaults,
    deserialize: (stored) => toShares(stored, defaults),
    // Nothing renders on a server here, so the stored widths can be read
    // while the first paint is drawn rather than corrected after it.
    getInitialValueInEffect: false,
  });
}

/**
 * Side by side where there is room for it, and one under the other where
 * there is not: a phone has one column, and a splitter across it would only
 * be two things too narrow to read.
 *
 * The search is a slot of its own rather than part of the outline, because the
 * pane is what decides that the bar stands still while the rows under it
 * scroll.
 */
export function Columns({
  search,
  outline,
  outlineRef,
  below,
  detail,
  detailFills = false,
  detailFrames = false,
}: {
  search: ReactNode;
  outline: ReactNode;
  /** The outline's scroller, for a page that has to bring a row into it. */
  outlineRef: RefObject<HTMLDivElement | null>;
  /** Under the rows in the same pane, scrolling apart from them. */
  below?: ReactNode;
  detail: ReactNode;
  /** The detail is a canvas that fills its pane and moves itself, rather than a page to scroll. */
  detailFills?: boolean;
  /**
   * The detail draws its own panes in `PANE_FRAME` where the columns stand
   * side by side, so the page leaves its frame out around them.
   */
  detailFrames?: boolean;
}) {
  const wide = useWideColumns();
  const [columns, setColumns] = useStoredShares(COLUMNS_KEY, DEFAULT_COLUMNS);
  const [hidden, storeHidden] = useLocalStorage<boolean>({
    key: TREE_HIDDEN_KEY,
    defaultValue: false,
    getInitialValueInEffect: false,
  });
  // Put away or brought back by the reader, the tree slides; as the page
  // opens, it is simply where it was left. The browser pictures the columns
  // before and after and moves between the two pictures, so neither pane is
  // laid out again on every frame, nor seen while it is built.
  const setHidden = useCallback(
    (next: boolean | ((was: boolean) => boolean)) => {
      const still = window.matchMedia('(prefers-reduced-motion: reduce)');
      if (document.startViewTransition === undefined || still.matches) {
        storeHidden(next);
        return;
      }
      document.startViewTransition(() => {
        flushSync(() => storeHidden(next));
      });
    },
    [storeHidden],
  );
  const searchRef = useRef<HTMLInputElement>(null);
  // Opened from the rail's search, the tree opens with its field in hand.
  const searchOnOpen = useRef(false);
  const fold = useMemo<TreeFold>(
    () => ({
      hide: () => setHidden(true),
      searchRef,
      shortcut: TREE_SHORTCUT,
    }),
    [setHidden],
  );
  const treeHidden = wide && hidden;

  // The tree's key, wherever the focus is; only where there are columns to
  // fold it from.
  useEffect(() => {
    if (!wide) return;
    const onKey = (event: KeyboardEvent) => {
      if (!isTreeShortcut(event)) return;
      event.preventDefault();
      setHidden((was) => !was);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [wide, setHidden]);
  useEffect(() => {
    if (treeHidden || !searchOnOpen.current) return;
    searchOnOpen.current = false;
    searchRef.current?.focus();
  }, [treeHidden]);

  // One of the two branches renders, so the outline's scroller is one element.
  const outlinePane = (
    <>
      <Box className={classes.searchBar}>
        <TreeFoldContext value={wide ? fold : null}>{search}</TreeFoldContext>
      </Box>
      <Box className={classes.outlineBody} ref={outlineRef}>
        {outline}
      </Box>
      {below !== undefined && <Box className={classes.below}>{below}</Box>}
    </>
  );
  const detailPane = (
    <Box className={detailFills ? classes.paneFill : classes.paneBody}>
      {detail}
    </Box>
  );

  if (!wide) {
    return (
      <Stack gap="md" className={classes.stacked}>
        <Box className={classes.pane} data-outline>
          {outlinePane}
        </Box>
        <Box className={classes.pane}>{detailPane}</Box>
      </Stack>
    );
  }

  if (treeHidden) {
    return (
      <div className={classes.columns} data-folded>
        {/* The tree put away: a rail where it stood, its way back in the
            corner the button that hid it was in, and its search a press
            away, landing in the field. */}
        <Box className={classes.rail}>
          <Tooltip
            label={`Show tree ${TREE_SHORTCUT}`}
            position="right"
            openDelay={300}
          >
            <ActionIcon
              variant="subtle"
              color="gray"
              size="input-sm"
              aria-label="Show the tree"
              aria-keyshortcuts="Meta+Backslash Control+Backslash"
              onClick={() => setHidden(false)}
            >
              <IconLayoutSidebarLeftExpand size={18} stroke={1.6} aria-hidden />
            </ActionIcon>
          </Tooltip>
          <Tooltip label="Search" position="right" openDelay={300}>
            <ActionIcon
              variant="subtle"
              color="gray"
              size="input-sm"
              aria-label="Search the outline"
              onClick={() => {
                searchOnOpen.current = true;
                setHidden(false);
              }}
            >
              <IconSearch size={18} stroke={1.6} aria-hidden />
            </ActionIcon>
          </Tooltip>
        </Box>
        <Box
          className={classes.pane}
          data-wide
          data-bare={detailFrames || undefined}
        >
          {detailPane}
        </Box>
      </div>
    );
  }

  return (
    <Splitter
      className={classes.columns}
      // The handle is a `separator` the reader can take with the keyboard, so
      // it needs a name of its own; Mantine gives it none.
      attributes={{ handle: { 'aria-label': 'Resize the columns' } }}
      sizes={columns}
      onSizeChange={(sizes) => setColumns(sizes.map(Number))}
    >
      <Splitter.Pane
        defaultSize={columns[0] ?? DEFAULT_COLUMNS[0]!}
        min="16rem"
        className={classes.pane}
        data-outline
      >
        {outlinePane}
      </Splitter.Pane>
      <Splitter.Pane
        defaultSize={columns[1] ?? DEFAULT_COLUMNS[1]!}
        min="20rem"
        className={classes.pane}
        data-bare={detailFrames || undefined}
      >
        {detailPane}
      </Splitter.Pane>
    </Splitter>
  );
}
