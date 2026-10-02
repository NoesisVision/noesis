import { createContext, type ReactNode, useContext, useState } from 'react';
import type { ScenarioEntry } from './scenarios-of.ts';

/**
 * Which of an element's scenarios are open, shared by the column that folds
 * them and the rules that point at them: a rule's count opens its own
 * scenarios, closes the rest, and takes the reader to the first of them.
 */
interface ScenarioFocus {
  /** The open scenarios, by their place in the column. */
  open: string[];
  setOpen: (open: string[]) => void;
  /** Opens a rule's scenarios, and only those, and brings the first into view. */
  showRule: (rule: string) => void;
}

const ScenarioFocusContext = createContext<ScenarioFocus | null>(null);

/** How long a scenario takes to fold or unfold, in ms; the column folds them at this pace. */
export const SCENARIO_TRANSITION = 200;

/**
 * Brings a scenario to the top of the view and puts the keyboard on its
 * control, as a reader who clicked down to it would have it. Asked once the
 * scenarios above it have folded: while they fold, it is still moving up.
 * How the scroll is made is the stylesheet's to say, as it is for the tree.
 */
const revealScenario = (value: string) =>
  setTimeout(() => {
    const item = document.querySelector<HTMLElement>(
      `[data-scenario="${value}"]`,
    );
    item?.scrollIntoView({ block: 'start' });
    item?.querySelector<HTMLElement>('button')?.focus({ preventScroll: true });
  }, SCENARIO_TRANSITION);

/** What a rule's count opens: its own scenarios, by their place in the column, and nothing else. */
export const scenariosOfRule = (
  scenarios: ScenarioEntry[],
  rule: string,
): string[] =>
  scenarios.flatMap((entry, index) =>
    entry.rule === rule ? [String(index)] : [],
  );

/** None outside an element's panel: a rule drawn alone has no column to open. */
export const useScenarioFocus = () => useContext(ScenarioFocusContext);

/** Every scenario folded to start; it lives as long as the panel shows one element. */
export function ScenarioFocusProvider({
  scenarios,
  children,
}: {
  scenarios: ScenarioEntry[];
  children: ReactNode;
}) {
  const [open, setOpen] = useState<string[]>([]);
  const showRule = (rule: string) => {
    const values = scenariosOfRule(scenarios, rule);
    setOpen(values);
    if (values[0] !== undefined) revealScenario(values[0]);
  };
  return (
    <ScenarioFocusContext.Provider value={{ open, setOpen, showRule }}>
      {children}
    </ScenarioFocusContext.Provider>
  );
}
