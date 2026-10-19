import { createContext, type ReactNode, useContext, useState } from 'react';
import type { ScenarioEntry } from './scenarios-of.ts';

/**
 * Which of an element's scenarios are open, shared by the column that folds
 * them and the rules that point at them: a rule's count opens its own
 * scenarios, closes the rest and greys them out, and takes the reader to the
 * first of them. The same count again lets go: every scenario folded, none
 * greyed out.
 */
interface ScenarioFocus {
  /** The open scenarios, by their place in the column. */
  open: string[];
  setOpen: (open: string[]) => void;
  /** The rule whose scenarios stand out from the rest; null while none does. */
  rule: string | null;
  /** Opens a rule's scenarios, and only those, and brings the first into view; asked again, lets go of them. */
  showRule: (rule: string) => void;
  /** Lets go of the rule, leaving the scenarios as they are. */
  release: () => void;
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

/**
 * Where a rule's count leaves the column: its rule standing out and its
 * scenarios open, or — asked by the rule that already stands out — no rule
 * and every scenario folded.
 */
export const focusRule = (
  scenarios: ScenarioEntry[],
  current: string | null,
  asked: string,
): { rule: string | null; open: string[] } =>
  asked === current
    ? { rule: null, open: [] }
    : { rule: asked, open: scenariosOfRule(scenarios, asked) };

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
  const [rule, setRule] = useState<string | null>(null);
  const showRule = (asked: string) => {
    const next = focusRule(scenarios, rule, asked);
    setRule(next.rule);
    setOpen(next.open);
    if (next.open[0] !== undefined) revealScenario(next.open[0]);
  };
  const release = () => setRule(null);
  return (
    <ScenarioFocusContext.Provider
      value={{ open, setOpen, rule, showRule, release }}
    >
      {children}
    </ScenarioFocusContext.Provider>
  );
}
