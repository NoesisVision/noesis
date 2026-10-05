import type { ReactNode } from 'react';
import { Splitter } from '#/shared/design-system/splitter.tsx';
import { useStoredShares } from '../columns.tsx';
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
 * read; under that, the scenarios follow the sections.
 */
export function ElementColumns({
  width,
  sections,
  scenarios,
}: {
  /** The panel body's width, measured by its owner, which outlives an element. */
  width: number;
  sections: ReactNode;
  /** `null` for an element with none: the sections then take the panel. */
  scenarios: ReactNode | null;
}) {
  const [shares, setShares] = useStoredShares(
    SCENARIO_COLUMNS_KEY,
    DEFAULT_SHARES,
  );

  if (scenarios === null) {
    return <div className={classes.sections}>{sections}</div>;
  }

  if (width < TWO_COLUMNS) {
    return (
      <>
        <div className={classes.sections}>{sections}</div>
        <aside className={classes.aside}>{scenarios}</aside>
      </>
    );
  }

  return (
    <Splitter
      className={classes.split}
      classNames={{ thumb: classes.splitThumb }}
      // The handle is a `separator` the reader can take with the keyboard,
      // so it needs a name of its own; Mantine gives it none.
      attributes={{ handle: { 'aria-label': 'Resize the scenarios' } }}
      sizes={shares}
      onSizeChange={(sizes) => setShares(sizes.map(Number))}
      lineSize={1}
    >
      <Splitter.Pane
        defaultSize={shares[0] ?? DEFAULT_SHARES[0]!}
        min="20rem"
        className={classes.splitPane}
      >
        <div className={classes.sections}>{sections}</div>
      </Splitter.Pane>
      <Splitter.Pane
        defaultSize={shares[1] ?? DEFAULT_SHARES[1]!}
        min="280px"
        className={classes.splitPane}
      >
        <div className={classes.stickyScenarios}>{scenarios}</div>
      </Splitter.Pane>
    </Splitter>
  );
}
