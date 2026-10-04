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
 * page is laid out, so anything that is not a pair of shares reads as the
 * default. Parsing is the one throwing call, and it is kept to this helper.
 */
function toColumns(stored: string | undefined): number[] {
  try {
    const parsed: unknown = stored === undefined ? null : JSON.parse(stored);
    const pair =
      Array.isArray(parsed) &&
      parsed.length === DEFAULT_COLUMNS.length &&
      parsed.every(
        (share) => typeof share === 'number' && share > 0 && share < 100,
      );
    if (pair) return parsed as number[];
  } catch {
    // Unreadable is the same as absent.
  }
  return DEFAULT_COLUMNS;
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
}) {
  const wide = useMediaQuery(WIDE, true);
  const [columns, setColumns] = useLocalStorage<number[]>({
    key: COLUMNS_KEY,
    defaultValue: DEFAULT_COLUMNS,
    deserialize: toColumns,
    // Nothing renders on a server here, so the stored widths can be read
    // while the first paint is drawn rather than corrected after it.
    getInitialValueInEffect: false,
  });

  // One of the two branches renders, so the outline's scroller is one element.
  const outlinePane = (
    <>
      <Box className={classes.searchBar}>{search}</Box>
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
