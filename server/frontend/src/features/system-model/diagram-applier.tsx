import {
  createContext,
  type ReactNode,
  use,
  useCallback,
  useMemo,
  useState,
} from 'react';
import type { DiagramPlan } from '#backend/app/system-model/diagram-plan.ts';
import type { DiagramApplier, PlanOutcome } from './diagram-plan.ts';

interface DiagramApplying {
  /** The exploration on the page, while there is one; null elsewhere. */
  applier: DiagramApplier | null;
  /** The exploration says it is here, and takes itself away when it goes. */
  register: (applier: DiagramApplier) => () => void;
  /** Applies a plan named by the entry it came in, and remembers what it did. */
  applyPlan: (entryId: string, plan: DiagramPlan) => void;
  outcomes: ReadonlyMap<string, PlanOutcome>;
}

const DiagramApplierContext = createContext<DiagramApplying>({
  applier: null,
  register: () => () => {},
  applyPlan: () => {},
  outcomes: new Map(),
});

/**
 * The way a plan the agent answered with reaches the diagram: the
 * exploration registers what it can do while it is on the page, and the
 * agent's card applies through it and reads back what happened.
 */
export function DiagramApplierProvider({ children }: { children: ReactNode }) {
  const [applier, setApplier] = useState<DiagramApplier | null>(null);
  const [outcomes, setOutcomes] = useState<ReadonlyMap<string, PlanOutcome>>(
    () => new Map(),
  );
  const register = useCallback((next: DiagramApplier) => {
    setApplier(next);
    return () => setApplier((current) => (current === next ? null : current));
  }, []);
  const applyPlan = useCallback(
    (entryId: string, plan: DiagramPlan) => {
      if (applier === null) return;
      const outcome = applier.apply(plan);
      setOutcomes((all) => new Map(all).set(entryId, outcome));
    },
    [applier],
  );
  const value = useMemo(
    () => ({ applier, register, applyPlan, outcomes }),
    [applier, register, applyPlan, outcomes],
  );
  return (
    <DiagramApplierContext value={value}>{children}</DiagramApplierContext>
  );
}

export function useDiagramApplier(): DiagramApplying {
  return use(DiagramApplierContext);
}
