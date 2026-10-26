import { clsx } from 'clsx';
import type { ReactNode } from 'react';
import { Splitter } from '#/shared/design-system/splitter.tsx';
import { PANE_FRAME, useStoredShares, useWideColumns } from '../columns.tsx';
import classes from './element-detail.module.css';

/** How the sections and the scenarios were last shared, for every element. */
const SCENARIO_COLUMNS_KEY = 'noesis.designDocs.scenarioColumns';
/** The 1.5 : 1 the two columns started at. */
const DEFAULT_SHARES = [60, 40];
/** The panel width, in px, from which two columns can be read (44rem). */
const TWO_COLUMNS = 704;

/**
 * An element's sections and, beside them, its scenarios — split by a handle
 * the reader can drag once the panel is wide enough for two columns to be
 * read; under that, the scenarios follow the sections. What the element is
 * heads the sections' column, so the scenarios run the panel's whole height.
 *
 * Where the page's columns stand side by side, the two are panes of the page
 * as the tree is — framed, each scrolling on its own, the same handle between
 * them — and the page leaves its own frame out around them.
 */
export function ElementColumns({
  width,
  lead,
  sections,
  scenarios,
}: {
  /** The panel body's width, measured by its owner, which outlives an element. */
  width: number;
  /** Over the sections, in their column: where the element sits, its name, what it is. */
  lead: ReactNode;
  sections: ReactNode;
  /** `null` for an element with none: the sections then take the panel. */
  scenarios: ReactNode | null;
}) {
  const [shares, setShares] = useStoredShares(
    SCENARIO_COLUMNS_KEY,
    DEFAULT_SHARES,
  );
  // Stacked, the page frames the element and scrolls it with the rest.
  const wide = useWideColumns();

  const content = (
    <>
      {lead}
      <div className={classes.sections}>{sections}</div>
    </>
  );

  const below =
    scenarios === null ? null : (
      <aside className={clsx(classes.aside, classes.scenarioPane)}>
        {scenarios}
      </aside>
    );

  if (wide && (scenarios === null || width < TWO_COLUMNS)) {
    // One pane, framed as the page's are, scrolling the element as one.
    return (
      <div className={clsx(PANE_FRAME, classes.frame)} data-own-scroll>
        <div className={classes.scroller}>
          {content}
          {below}
        </div>
      </div>
    );
  }

  if (wide) {
    return (
      <Splitter
        className={classes.frames}
        data-own-scroll
        // As the page's own handle, between panes as the page's own.
        attributes={{ handle: { 'aria-label': 'Resize the scenarios' } }}
        sizes={shares}
        onSizeChange={(sizes) => setShares(sizes.map(Number))}
      >
        <Splitter.Pane
          defaultSize={shares[0] ?? DEFAULT_SHARES[0]!}
          min="20rem"
          className={PANE_FRAME}
        >
          <div className={classes.scroller}>{content}</div>
        </Splitter.Pane>
        <Splitter.Pane
          defaultSize={shares[1] ?? DEFAULT_SHARES[1]!}
          min="280px"
          className={clsx(PANE_FRAME, classes.scenarioPane)}
        >
          <div className={classes.scroller}>{scenarios}</div>
        </Splitter.Pane>
      </Splitter>
    );
  }

  if (scenarios === null) return content;

  if (width < TWO_COLUMNS) {
    return (
      <>
        {content}
        {below}
      </>
    );
  }

  return (
    <Splitter
      className={classes.split}
      classNames={{ handle: classes.splitHandle, thumb: classes.splitThumb }}
      // The handle is a `separator` the reader can take with the keyboard,
      // so it needs a name of its own; Mantine gives it none.
      attributes={{ handle: { 'aria-label': 'Resize the scenarios' } }}
      sizes={shares}
      onSizeChange={(sizes) => setShares(sizes.map(Number))}
    >
      <Splitter.Pane
        defaultSize={shares[0] ?? DEFAULT_SHARES[0]!}
        min="20rem"
        className={classes.splitPane}
      >
        {content}
      </Splitter.Pane>
      <Splitter.Pane
        defaultSize={shares[1] ?? DEFAULT_SHARES[1]!}
        min="280px"
        className={clsx(classes.splitPane, classes.scenarioPane)}
      >
        <div className={classes.stickyScenarios}>{scenarios}</div>
      </Splitter.Pane>
    </Splitter>
  );
}
