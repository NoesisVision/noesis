import type { ReactNode, RefObject } from 'react';
import { Box } from '#/shared/design-system/box.tsx';
import {
  useLocalStorage,
  useMediaQuery,
} from '#/shared/design-system/hooks.ts';
import { Splitter } from '#/shared/design-system/splitter.tsx';
import { Stack } from '#/shared/design-system/stack.tsx';
import classes from './columns.module.css';

/** How the two columns were last left, which is not about any one document. */
const COLUMNS_KEY = 'noesis.designDocs.columns';
const DEFAULT_COLUMNS = [38, 62];
/** The width the shell folds its sidebar at, past which two columns fit. */
const WIDE = '(min-width: 62em)';

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
  detail,
}: {
  search: ReactNode;
  outline: ReactNode;
  /** The outline's scroller, for a page that has to bring a row into it. */
  outlineRef: RefObject<HTMLDivElement | null>;
  detail: ReactNode;
}) {
  const wide = useMediaQuery(WIDE, true);
  const [columns, setColumns] = useStoredShares(COLUMNS_KEY, DEFAULT_COLUMNS);

  // One of the two branches renders, so the outline's scroller is one element.
  const outlinePane = (
    <>
      <Box className={classes.searchBar}>{search}</Box>
      <Box className={classes.outlineBody} ref={outlineRef}>
        {outline}
      </Box>
    </>
  );
  const detailPane = <Box className={classes.paneBody}>{detail}</Box>;

  if (!wide) {
    return (
      <Stack gap="md" className={classes.stacked}>
        <Box className={classes.pane}>{outlinePane}</Box>
        <Box className={classes.pane}>{detailPane}</Box>
      </Stack>
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
      lineSize={4}
    >
      <Splitter.Pane
        defaultSize={columns[0] ?? DEFAULT_COLUMNS[0]!}
        min="16rem"
        className={classes.pane}
      >
        {outlinePane}
      </Splitter.Pane>
      <Splitter.Pane
        defaultSize={columns[1] ?? DEFAULT_COLUMNS[1]!}
        min="20rem"
        className={classes.pane}
      >
        {detailPane}
      </Splitter.Pane>
    </Splitter>
  );
}
